"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CONTROLLER_PROFILES, CONTROL_TARGETS, PARTY_MIX_GUIDE, describeKey, profileForDevice, interpret, learn, learnMismatch, parseMidi, type MidiKey, type MidiMessage } from "@/lib/audio/midi";
import { emitControl } from "./controlBus";
import { usePresetSlot } from "./presets";

const LS_MAP = "ncvr.midi.mapping";
const LS_AUTO = "ncvr.midi.autoconnect";
const LS_FLIP = "ncvr.midi.flipPitch";

function readLS<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writeLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

/**
 * DJ controller (Web MIDI). Chrome / Edge / Opera on desktop. The mapping is
 * learned per control and saved with console presets (and in this browser).
 */
export function MidiPanel() {
  const [supported, setSupported] = useState(true);
  const [access, setAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<MidiKey, string>>({});
  const [learning, setLearning] = useState<string | null>(null);
  const [last, setLast] = useState<MidiMessage | null>(null);
  const [blink, setBlink] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ t: number; dev: string; raw: string; desc: string }>>([]);
  const [showLog, setShowLog] = useState(false);
  const [portIssues, setPortIssues] = useState<string[]>([]);
  const [flipPitch, setFlipPitch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const guideRef = useRef<number | null>(null);
  guideRef.current = guide;
  const guideUsed = useRef(new Set<string>());   // controls already assigned during this guided run
  const guideWait = useRef(0);                    // ignore input briefly after each step
  const flipRef = useRef(false);
  const showLogRef = useRef(false);
  const lastUi = useRef(0);
  flipRef.current = flipPitch;
  showLogRef.current = showLog;
  const accessRef = useRef<MIDIAccess | null>(null);
  const learnRef = useRef<string | null>(null);
  const mapRef = useRef(mapping);
  learnRef.current = learning;
  mapRef.current = mapping;

  usePresetSlot("midi", mapping, (m) => { setMapping(m); writeLS(LS_MAP, m); });

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && "requestMIDIAccess" in navigator);
    setMapping(readLS(LS_MAP, {}));
    setFlipPitch(readLS(LS_FLIP, false));
  }, []);

  const applyProfile = useCallback((id: string) => {
    const p = CONTROLLER_PROFILES.find((x) => x.id === id);
    if (!p) return;
    setMapping(p.mapping); writeLS(LS_MAP, p.mapping); setLearning(null);
    setNotice(`${p.name} map loaded — ${Object.keys(p.mapping).length} controls. ${p.notes}`);
  }, []);

  // First time a known controller is plugged in with nothing mapped yet, load its map automatically.
  useEffect(() => {
    if (Object.keys(mapRef.current).length) return;
    const p = devices.map(profileForDevice).find(Boolean);
    if (p) applyProfile(p.id);
  }, [devices, applyProfile]);

  const onMessage = useCallback((e: MIDIMessageEvent) => {
    if (!e.data || e.data.length === 0 || e.data[0] >= 0xf8) return; // clock / active-sensing noise
    const msg = parseMidi(e.data);
    const dev = (e.currentTarget as MIDIInput | null)?.name ?? "MIDI";
    const raw = Array.from(e.data, (b) => b.toString(16).padStart(2, "0")).join(" ");
    const nowMs = performance.now();
    if (showLogRef.current) setLog((l) => [{ t: Date.now(), dev, raw, desc: msg ? `${describeKey(msg.key)} = ${msg.value}${msg.type === "note" ? (msg.on ? " (press)" : " (release)") : ""}` : "not used by the console" }, ...l].slice(0, 14));
    if (!msg) return;
    // Screen updates are throttled: a chatty controller must not keep the page busy.
    if (nowMs - lastUi.current > 100 || learnRef.current || guideRef.current !== null) {
      lastUi.current = nowMs;
      setLast(msg);
      setBlink(true);
      setTimeout(() => setBlink(false), 90);
    }
    const step = guideRef.current;
    if (step !== null) {
      const t = PARTY_MIX_GUIDE[step]?.target;
      if (!t || performance.now() < guideWait.current || guideUsed.current.has(msg.key)) return;
      if (msg.type === "note" && !msg.on) return;
      const why = learnMismatch(msg, t);
      if (why) { setHint(why); return; }
      const next = learn(mapRef.current, msg, t);
      setMapping(next); writeLS(LS_MAP, next); mapRef.current = next;
      guideUsed.current.add(msg.key);
      guideWait.current = performance.now() + 700;
      setHint(null);
      setGuide(step + 1 < PARTY_MIX_GUIDE.length ? step + 1 : null);
      if (step + 1 >= PARTY_MIX_GUIDE.length) setNotice("Controller setup finished — every control is mapped. Click Save on the Presets bar to keep it.");
      return;
    }
    const target = learnRef.current;
    if (target) {
      const why = learnMismatch(msg, target);
      if (why) { setHint(why); return; }
      const next = learn(mapRef.current, msg, target);
      if (next !== mapRef.current) { setMapping(next); writeLS(LS_MAP, next); setLearning(null); setHint(null); }
      return;
    }
    const action = interpret(msg, mapRef.current);
    if (action?.kind === "range" && action.target.endsWith(".pitch") && flipRef.current) action.value = 1 - action.value;
    if (action) emitControl(action);
  }, []);

  const bind = useCallback((a: MIDIAccess) => {
    const names: string[] = [];
    const issues: string[] = [];
    a.inputs.forEach((input) => {
      input.onmidimessage = onMessage;
      names.push(input.name ?? "MIDI device");
      // Open explicitly so a port held by another app reports an error instead of staying silent.
      input.open().catch(() => issues.push(input.name ?? "MIDI device"));
    });
    setDevices(names);
    setTimeout(() => {
      a.inputs.forEach((input) => { if (input.connection !== "open" && !issues.includes(input.name ?? "")) issues.push(input.name ?? "MIDI device"); });
      setPortIssues([...issues]);
    }, 600);
  }, [onMessage]);

  const connect = useCallback(async () => {
    setErr(null);
    try {
      accessRef.current?.inputs.forEach((i) => { i.onmidimessage = null; i.close().catch(() => null); });
      const a = await navigator.requestMIDIAccess({ sysex: false });
      setAccess(a);
      accessRef.current = a;
      bind(a);
      a.onstatechange = () => bind(a);
      writeLS(LS_AUTO, true);
    } catch (e) {
      setErr((e as Error).name === "SecurityError" || (e as Error).name === "NotAllowedError"
        ? "MIDI access was blocked. Allow MIDI devices for this site in your browser settings."
        : (e as Error).message);
    }
  }, [bind]);

  useEffect(() => { setHint(null); }, [learning]);

  useEffect(() => { if (supported && readLS(LS_AUTO, false)) connect(); }, [supported, connect]);
  useEffect(() => () => { access?.inputs.forEach((i) => { i.onmidimessage = null; }); }, [access]);

  const assigned = (target: string) => Object.entries(mapping).find(([, v]) => v === target)?.[0];
  const groups = [...new Set(CONTROL_TARGETS.map((t) => t.group))];
  const count = Object.keys(mapping).length;

  return (
    <section className="glass p-4" aria-label="DJ controller">
      <div className="flex flex-wrap items-center gap-3">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">DJ CONTROLLER</div>
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${blink ? "bg-[var(--color-signal)] shadow-[var(--shadow-glow-signal)]" : access ? "bg-[var(--color-signal)]/40" : "bg-white/20"}`} />
        {!supported ? (
          <span className="text-xs text-[var(--color-gold)]">This browser has no MIDI support — use Chrome or Edge on a computer.</span>
        ) : !access ? (
          <button type="button" className="btn btn-primary px-3 py-1.5 text-xs" onClick={connect}>Connect controller</button>
        ) : devices.length ? (
          <span className="text-xs text-[var(--color-signal)]">Connected: {devices.join(", ")}</span>
        ) : (
          <span className="text-xs text-[var(--color-gold)]">No controller found — plug it in by USB (it appears automatically).</span>
        )}
        <span className="text-xs text-[var(--color-muted)]">{count} control{count === 1 ? "" : "s"} mapped</span>
        {last && <span className="font-mono text-[10px] text-[var(--color-muted)]">last: {describeKey(last.key)} = {last.value}</span>}
        {access && <button type="button" className="btn btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={connect}>Reconnect</button>}
        {access && <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" aria-expanded={showLog} onClick={() => setShowLog(!showLog)}>{showLog ? "Hide MIDI monitor" : "MIDI monitor"}</button>}
        <button type="button" className={`btn btn-ghost px-3 py-1.5 text-xs ${access ? "" : "ml-auto"}`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide mapping" : "Map controls (MIDI Learn)"}</button>
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      {notice && (
        <p role="status" className="mt-2 rounded-lg border border-[var(--color-signal)]/40 bg-[var(--color-signal)]/10 p-2 text-xs">
          {notice} <button type="button" className="ml-2 underline" onClick={() => setNotice(null)}>OK</button>
        </p>
      )}
      {portIssues.length > 0 && (
        <p role="alert" className="mt-2 rounded-lg border border-red-400/50 bg-red-500/10 p-2 text-xs">
          <strong>{portIssues.join(", ")}</strong> is connected but another program is holding it, so the console can&apos;t hear it.
          Fully quit <strong>Serato DJ Lite, VirtualDJ, Rekordbox, Mixxx, djay</strong> (check the system tray too), then press <strong>Reconnect</strong>.
          If it still fails, unplug the USB cable for 5 seconds and plug it back in.
        </p>
      )}
      {guide !== null && (
        <div role="status" className="mt-3 rounded-lg border border-[var(--color-gold)]/60 bg-[var(--color-gold)]/10 p-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Controller setup · step {guide + 1} of {PARTY_MIX_GUIDE.length}</div>
          <div className="mt-1 text-lg font-bold">{PARTY_MIX_GUIDE[guide].prompt}</div>
          {hint && <p className="mt-1 text-xs text-[var(--color-gold)]">{hint}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setHint(null); setGuide(guide + 1 < PARTY_MIX_GUIDE.length ? guide + 1 : null); }}>Skip</button>
            {guide > 0 && <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setHint(null); setGuide(guide - 1); }}>Back</button>}
            <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { setHint(null); setGuide(null); }}>Stop</button>
          </div>
        </div>
      )}
      {learning && (
        <div role="status" className="mt-3 rounded-lg border border-[var(--color-gold)]/60 bg-[var(--color-gold)]/10 p-2 text-sm">
          Now move or press the control on your controller for <strong>{CONTROL_TARGETS.find((t) => t.id === learning)?.group} — {CONTROL_TARGETS.find((t) => t.id === learning)?.label}</strong>…
          <button type="button" className="ml-3 text-xs underline" onClick={() => setLearning(null)}>Cancel</button>
          {hint && <p className="mt-1 text-xs text-[var(--color-gold)]">{hint}</p>}
          {!last && <p className="mt-1 text-xs text-[var(--color-muted)]">Nothing received from the controller yet. If nothing appears when you touch it, see the MIDI monitor below.</p>}
        </div>
      )}
      {showLog && (
        <div className="mt-3 rounded-xl border border-white/10 p-3">
          <div className="kicker mb-1 text-[10px]">MIDI monitor — every message your controller sends</div>
          {log.length ? (
            <ul className="space-y-0.5 font-mono text-[11px]">
              {log.map((m) => <li key={`${m.t}-${m.raw}`}><span className="text-[var(--color-muted)]">{m.dev}</span> · {m.raw} · <span className="text-[var(--color-signal)]">{m.desc}</span></li>)}
            </ul>
          ) : (
            <div className="space-y-1 text-xs text-[var(--color-muted)]">
              <p>Nothing received yet. Press a button on the controller. If nothing shows here:</p>
              <ol className="list-decimal pl-5">
                <li>Quit every DJ app (Serato DJ Lite, VirtualDJ, Rekordbox, Mixxx, djay) — on Windows only one program can use the controller.</li>
                <li>Use Chrome or Edge, and allow “MIDI devices” for this site (padlock icon → Site settings).</li>
                <li>Unplug the controller, plug it back in, then press <strong>Reconnect</strong>.</li>
              </ol>
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-gold px-3 py-1 text-xs" disabled={!access || !devices.length}
              onClick={() => { guideUsed.current = new Set(); guideWait.current = 0; setLearning(null); setNotice(null); setGuide(0); }}>
              Guided setup (1 minute)
            </button>
            {CONTROLLER_PROFILES.map((p) => (
              <button key={p.id} type="button" className="btn btn-primary px-3 py-1 text-xs"
                onClick={() => { if (!count || window.confirm(`Replace your current mapping with the ${p.name} map?`)) applyProfile(p.id); }}>
                Load {p.name} map
              </button>
            ))}
            <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <input type="checkbox" checked={flipPitch} className="accent-[var(--color-gold)]"
                onChange={(e) => { setFlipPitch(e.target.checked); writeLS(LS_FLIP, e.target.checked); }} />
              Reverse pitch faders
            </label>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Click <strong>Learn</strong>, then touch the matching knob, fader, button or jog wheel. Knobs, faders and jog wheels must be turned (not pressed). For scratching, map both the jog wheel (turn it) and the jog wheel top (rest your hand on it).
            Your mapping is remembered in this browser and saved inside console presets.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <div key={g} className="rounded-xl border border-white/10 p-3">
                <div className="kicker mb-2 text-[10px]">{g}</div>
                <ul className="space-y-1">
                  {CONTROL_TARGETS.filter((t) => t.group === g).map((t) => {
                    const k = assigned(t.id);
                    return (
                      <li key={t.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1">{t.label}</span>
                        <span className={`font-mono text-[10px] ${k ? "text-[var(--color-signal)]" : "text-[var(--color-muted)]"}`}>{k ? describeKey(k) : "—"}</span>
                        <button type="button" disabled={!access} onClick={() => setLearning(learning === t.id ? null : t.id)}
                          className={`btn px-2 py-0.5 text-[10px] ${learning === t.id ? "btn-gold" : "btn-ghost"}`}>{learning === t.id ? "Listening…" : "Learn"}</button>
                        {k && <button type="button" aria-label={`Clear ${t.label}`} className="text-[var(--color-muted)] hover:text-red-300"
                          onClick={() => { const n = { ...mapping }; delete n[k]; setMapping(n); writeLS(LS_MAP, n); }}>×</button>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {count > 0 && <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => { if (window.confirm("Clear all controller mappings?")) { setMapping({}); writeLS(LS_MAP, {}); } }}>Clear all mappings</button>}
        </div>
      )}
    </section>
  );
}
