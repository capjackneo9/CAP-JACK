"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlAction } from "@/lib/audio/midi";
import { VOICE_HELP, WAKE_WORD, parseVoiceCommand, stripWakeWord } from "@/lib/audio/voice";
import { emitControl, useControlReports } from "./controlBus";

/* Minimal typing for the browser speech recognizer (Chrome / Edge: webkitSpeechRecognition). */
interface SpeechAlt { transcript: string }
interface SpeechRes { isFinal: boolean; 0: SpeechAlt }
interface SpeechEvt { resultIndex: number; results: ArrayLike<SpeechRes> }
interface Recognizer {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: SpeechEvt) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type RecognizerCtor = new () => Recognizer;

const LS_WAKE = "ncvr.voice.wake";
const CONFIRM_MS = 10000;

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice commands for the console. Say the wake word first (“Console, play deck A”)
 * so normal on-air talk never triggers anything. Going live / ending the broadcast
 * always waits for “confirm”.
 */
export function VoicePanel() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [wake, setWake] = useState(true);
  const [heard, setHeard] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [feedback, setFeedback] = useState<{ text: string; tone: "ok" | "warn" | "err" } | null>(null);
  const [pending, setPending] = useState<{ action: ControlAction; say: string; until: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  const onRef = useRef(false);
  const wakeRef = useRef(true);
  const pendingRef = useRef(pending);
  onRef.current = on;
  wakeRef.current = wake;
  pendingRef.current = pending;

  useEffect(() => {
    setSupported(Boolean(recognizerCtor()));
    try { const v = localStorage.getItem(LS_WAKE); if (v !== null) setWake(v === "1"); } catch { /* private mode */ }
  }, []);

  useControlReports((text) => setFeedback({ text, tone: "warn" }));

  // A command waiting for “confirm” expires.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => { setPending(null); setFeedback({ text: `“${pending.say}” cancelled — no confirm heard.`, tone: "warn" }); }, Math.max(0, pending.until - Date.now()));
    return () => clearTimeout(id);
  }, [pending]);

  const handle = useCallback((transcript: string) => {
    const waiting = pendingRef.current && pendingRef.current.until > Date.now() ? pendingRef.current : null;
    let phrase: string | null = wakeRef.current ? stripWakeWord(transcript) : transcript;
    // While a command waits for “confirm”, a bare “confirm” / “cancel” is enough.
    if (phrase === null && waiting && /^\s*(yes |)?(confirm|confirmed|cancel|no)\s*\.?$/i.test(transcript)) phrase = transcript;
    setHeard(transcript);
    if (phrase === null) return; // ordinary talk — ignored
    const r = parseVoiceCommand(phrase);
    if (!r) { setFeedback({ text: `Didn't catch a command in “${phrase}”. Say “${WAKE_WORD}, help”.`, tone: "warn" }); return; }
    if (r.kind === "help") { setShowHelp(true); setFeedback({ text: "Here's what you can say.", tone: "ok" }); return; }
    if (r.kind === "cancel") { setPending(null); setFeedback({ text: waiting ? `Cancelled “${waiting.say}”.` : "Nothing to cancel.", tone: "ok" }); return; }
    if (r.kind === "confirm") {
      if (!waiting) { setFeedback({ text: "Nothing is waiting for confirm.", tone: "warn" }); return; }
      setPending(null);
      setFeedback({ text: `✓ ${waiting.say}`, tone: "ok" });
      emitControl(waiting.action);
      return;
    }
    if (r.confirm) {
      setPending({ action: r.action, say: r.say, until: Date.now() + CONFIRM_MS });
      setFeedback({ text: `“${r.say}” — say “confirm” within 10 seconds, or “cancel”.`, tone: "warn" });
      return;
    }
    setFeedback({ text: `✓ ${r.say}`, tone: "ok" });
    emitControl(r.action);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognizerCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) handle(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        onRef.current = false; setOn(false);
        setFeedback({ text: "Microphone permission for voice commands was blocked. Allow the microphone for this site and try again.", tone: "err" });
      } else if (e.error === "network") {
        setFeedback({ text: "The browser's speech service can't be reached — check the internet connection.", tone: "err" });
      } else if (e.error === "audio-capture") {
        setFeedback({ text: "No microphone found for voice commands. Set your mic as the default recording device.", tone: "err" });
      }
    };
    // Chrome stops listening after a while; keep it going while switched on.
    r.onend = () => { if (onRef.current) setTimeout(() => { if (onRef.current) { try { r.start(); } catch { /* already started */ } } }, 300); };
    rec.current = r;
    try { r.start(); } catch { /* already started */ }
  }, [handle]);

  useEffect(() => {
    if (on) start();
    else { rec.current?.abort(); rec.current = null; setInterim(""); }
    return () => { rec.current?.abort(); };
  }, [on, start]);

  const toneClass = feedback?.tone === "ok" ? "text-[var(--color-signal)]" : feedback?.tone === "err" ? "text-red-300" : "text-[var(--color-gold)]";

  return (
    <section className="glass p-4" aria-label="Voice commands">
      <div className="flex flex-wrap items-center gap-3">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">VOICE COMMANDS</div>
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${on ? "animate-pulse bg-[var(--color-live)]" : "bg-white/20"}`} />
        {!supported ? (
          <span className="text-xs text-[var(--color-gold)]">This browser has no speech recognition — use Chrome or Edge on a computer.</span>
        ) : (
          <button type="button" aria-pressed={on} className={`btn px-3 py-1.5 text-xs ${on ? "btn-live" : "btn-primary"}`}
            onClick={() => { setFeedback(null); setOn(!on); }}>{on ? "Listening — turn off" : "Turn on voice commands"}</button>
        )}
        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input type="checkbox" checked={wake} className="accent-[var(--color-gold)]"
            onChange={(e) => { setWake(e.target.checked); try { localStorage.setItem(LS_WAKE, e.target.checked ? "1" : "0"); } catch { /* private mode */ } }} />
          Start every command with “{WAKE_WORD}” (recommended — your on-air talk won&apos;t trigger anything)
        </label>
        <button type="button" className="btn btn-ghost ml-auto px-3 py-1.5 text-xs" aria-expanded={showHelp} onClick={() => setShowHelp(!showHelp)}>{showHelp ? "Hide commands" : "What can I say?"}</button>
      </div>
      {on && (
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-[var(--color-muted)]">Heard: <span className="font-mono text-white/80">{interim || heard || "…"}</span></p>
          {pending && (
            <p role="alert" className="rounded-lg border border-[var(--color-live)]/60 bg-[var(--color-live)]/15 p-2 text-sm">
              Waiting for “confirm”: <strong>{pending.say}</strong>
              <button type="button" className="ml-3 text-xs underline" onClick={() => setPending(null)}>Cancel</button>
            </p>
          )}
        </div>
      )}
      {feedback && <p role="status" className={`mt-2 text-xs ${toneClass}`}>{feedback.text}</p>}
      {showHelp && (
        <div className="mt-3 rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            {wake ? <>Say “<strong>{WAKE_WORD}</strong>” first, e.g. “{WAKE_WORD}, play deck A”.</> : "Wake word is off — any matching phrase runs."}
            {" "}Voice commands use the computer&apos;s default microphone and Chrome&apos;s speech service; if your mic is ON, listeners hear the command too, so close or mute the mic first (“mute mic” works by voice).
          </p>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {VOICE_HELP.map(([say, what]) => (
              <li key={say}><span className="font-mono text-[var(--color-gold)]">{say}</span> <span className="text-[var(--color-muted)]">— {what}</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
