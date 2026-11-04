"use client";
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Deck } from "@/lib/audio/engine";
import { Knob, MeterBar, Waveform, fmtTime } from "./parts";
import type { Meter } from "@/lib/audio/engine";
import { usePresetSlot } from "./presets";
import { useConsoleControl } from "./controlBus";
import { scaleRange } from "@/lib/audio/midi";
import { jogIsIntentional, nextPitch, NUDGE_SECONDS_PER_TICK, SCRATCH_RELEASE_MS, SCRATCH_SECONDS_PER_TICK, angleToSeconds } from "@/lib/audio/scratch";

type JogMode = "scratch" | "nudge";

export interface LibraryTrack { id: string; title: string; artistName: string; category: string }

export function DeckPanel({ deck, meter, library, label, sub, onLoaded }: { deck: Deck | null; meter?: Meter; library: LibraryTrack[]; label: string; sub: string; onLoaded?: (title: string, artist: string) => void }) {
  const [, force] = useState(0);
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0, filter: 0, trim: 1, fader: 0.8 });
  const [cue, setCue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [jogMode, setJogMode] = useState<JogMode>("scratch");
  const [pitch, setPitch] = useState(0); // playback-rate offset, ±0.08
  const touchHeld = useRef(false);     // controller jog top is being touched
  const hasTouch = useRef(false);      // this controller reports jog touch (so edge turns = nudge)
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jogTicks = useRef<Array<{ t: number; d: number }>>([]);
  const [ignoredTicks, setIgnoredTicks] = useState(0);

  usePresetSlot(deck?.id === "B" ? "deckB" : "deckA", { ...eq, cue, trackId, jogMode }, async (v) => {
    setEq({ trim: v.trim, filter: v.filter, low: v.low, mid: v.mid, high: v.high, fader: v.fader });
    setCue(v.cue);
    if (v.jogMode === "scratch" || v.jogMode === "nudge") setJogMode(v.jogMode);
    const t = v.trackId ? library.find((x) => x.id === v.trackId) : null;
    if (t && !deck?.playing) await load(`/api/studio/library/${t.id}/audio`, t.title, t.artistName, t.id);
  });

  useEffect(() => {
    if (!deck) return;
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [deck]);

  useEffect(() => {
    if (!deck) return;
    deck.eq.low.gain.value = eq.low; deck.eq.mid.gain.value = eq.mid; deck.eq.high.gain.value = eq.high;
    deck.eq.setFilter(eq.filter); deck.trim.gain.value = eq.trim; deck.fader.gain.value = eq.fader;
  }, [deck, eq]);
  useEffect(() => { if (deck) deck.cue.gain.value = cue ? 1 : 0; }, [deck, cue]);
  useEffect(() => {
    if (!deck) return;
    deck.setRate(1 + pitch); // vinyl-style: tempo and pitch move together
  }, [deck, pitch]);

  const pos = deck?.position ?? 0;
  const duration = deck?.duration ?? 0;
  const progress = duration ? pos / duration : 0;
  const loaded = !!deck?.hasTrack;

  /** Pitch-bend nudge while playing (speeds up / slows down briefly, no skipping). */
  function nudge(delta: number) {
    if (!deck?.duration) return;
    if (!deck.playing) {
      deck.seek(deck.position + delta * NUDGE_SECONDS_PER_TICK.paused);
      return;
    }
    deck.setRate(Math.min(1.25, Math.max(0.75, 1 + pitch + delta * 0.03)));
    if (bendTimer.current) clearTimeout(bendTimer.current);
    bendTimer.current = setTimeout(() => { deck.setRate(1 + pitch); }, 120);
  }

  function jog(delta: number) {
    if (!deck?.duration) return;
    // Ignore stray ticks while the record is playing and not being held (stops jitter stutter).
    const now = performance.now();
    jogTicks.current = [...jogTicks.current.filter((r) => now - r.t <= 300), { t: now, d: delta }];
    if (deck.playing && !deck.scratching && !touchHeld.current && !jogIsIntentional(jogTicks.current, now)) {
      setIgnoredTicks((n) => n + 1);
      return;
    }
    const scratchNow = jogMode === "scratch" && (touchHeld.current || !hasTouch.current);
    if (!scratchNow || !deck.beginScratch()) { nudge(delta); return; }
    deck.scratchBy(delta * SCRATCH_SECONDS_PER_TICK);
    if (!touchHeld.current) {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => { if (!touchHeld.current) deck.endScratch(); }, SCRATCH_RELEASE_MS);
    }
  }

  function touch(down: boolean) {
    if (!deck) return;
    hasTouch.current = true;
    touchHeld.current = down;
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    if (down && jogMode === "scratch") deck.beginScratch();
    if (!down) deck.endScratch();
  }
  const disabled = !deck;

  // DJ controller
  useConsoleControl([deck?.id === "B" ? "deckB" : "deckA"], (a) => {
    if (!deck) return;
    const param = a.target.split(".")[1];
    if (a.kind === "range" && param === "pitch") {
      setPitch((cur) => nextPitch(cur, scaleRange(a.target, a.value)));
    } else if (a.kind === "button" && param === "scratchMode") {
      setJogMode((m) => (m === "scratch" ? "nudge" : "scratch"));
    } else if (a.kind === "range" && ["trim", "filter", "low", "mid", "high", "fader"].includes(param)) {
      setEq((prev) => ({ ...prev, [param]: scaleRange(a.target, a.value) }));
    } else if (a.kind === "button" && param === "play") {
      if (deck.hasTrack) { if (deck.playing) deck.pause(); else deck.play().catch((e) => setErr(e.message)); }
    } else if (a.kind === "button" && param === "cue") {
      deck.pause(); deck.seek(0);
    } else if (a.kind === "button" && param === "pfl") {
      setCue((c) => !c);
    } else if (a.kind === "jog") {
      jog(a.delta);
    } else if (a.kind === "touch") {
      touch(a.down);
    }
    force((n) => n + 1);
  });

  async function load(src: File | string, title: string, artist: string, libraryId: string | null = null) {
    if (!deck) return;
    setLoading(true); setErr(null);
    try { await deck.load(src, { title, artist }); setTrackId(libraryId); onLoaded?.(title, artist); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); force((n) => n + 1); }
  }

  return (
    <section className="glass p-4" aria-label={label}>
      <header className="mb-2 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">{label}</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">{sub}</div>
        </div>
        <span className={`h-3 w-3 rounded-full ${deck?.playing ? "bg-[var(--color-signal)] shadow-[var(--shadow-glow-signal)]" : "bg-white/20"}`} aria-label={deck?.playing ? "Playing" : "Stopped"} />
      </header>
      <div className="truncate text-sm font-semibold">{deck?.title || "No track loaded"}</div>
      <div className="truncate text-xs text-[var(--color-muted)]">{deck?.artist}</div>
      <div className="mt-2"><Waveform peaks={deck?.peaks ?? null} progress={progress} onSeek={(p) => { if (duration) deck?.seek(p * duration); }} /></div>
      <div className="mt-1 flex justify-between font-mono text-xs text-[var(--color-muted)]"><span>{fmtTime(pos)}</span><span>-{fmtTime(duration - pos)}</span></div>
      <div className="mt-3 flex items-center gap-3">
        <Platter deck={deck} enabled={jogMode === "scratch"} />
        <div className="space-y-1 text-xs">
          <div className="label">Jog wheel{pitch !== 0 && <span className="ml-2 font-mono text-[var(--color-gold)]">pitch {pitch > 0 ? "+" : ""}{(pitch * 100).toFixed(1)}%</span>}</div>
          <div className="flex gap-1" role="group" aria-label="Jog wheel mode">
            {(["scratch", "nudge"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={jogMode === m} onClick={() => setJogMode(m)}
                className={`btn px-2.5 py-1 text-[11px] uppercase ${jogMode === m ? "btn-gold" : "btn-ghost"}`}>{m}</button>
            ))}
          </div>
          <p className="max-w-[16rem] text-[10px] text-[var(--color-muted)]">
            {jogMode === "scratch"
              ? deck?.scratchReady ? "Turn the jog wheel (or drag the record) to scratch — forwards and backwards." : "Scratch is ready once a track has finished loading & analysing."
              : "Turn to speed up / slow down the track for beat matching (scrubs when paused)."}
          </p>
          {ignoredTicks > 20 && (
            <p className="max-w-[16rem] text-[10px] text-[var(--color-gold)]">
              Your controller keeps sending tiny jog-wheel movements for this deck ({ignoredTicks} ignored) — they no longer interrupt the music.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary px-4 py-1.5 text-sm" disabled={disabled || !loaded}
          onClick={() => (deck!.playing ? deck!.pause() : deck!.play().catch((e) => setErr(e.message)))}>{deck?.playing ? "Pause" : "Play"}</button>
        <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" disabled={disabled || !loaded} onClick={() => { deck?.pause(); deck?.seek(0); }}>Cue to start</button>
        <button type="button" aria-pressed={cue} className={`btn px-3 py-1.5 text-sm ${cue ? "btn-gold" : "btn-ghost"}`} disabled={disabled} onClick={() => setCue(!cue)}>PFL / Cue</button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Knob label="Trim" value={eq.trim} min={0} max={2} onChange={(v) => setEq({ ...eq, trim: v })} />
          <Knob label="Filter" value={eq.filter} min={-1} max={1} onChange={(v) => setEq({ ...eq, filter: v })} tone="ncvr-range-gold" />
          <Knob label="High dB" value={eq.high} min={-24} max={12} step={0.5} onChange={(v) => setEq({ ...eq, high: v })} />
          <Knob label="Mid dB" value={eq.mid} min={-24} max={12} step={0.5} onChange={(v) => setEq({ ...eq, mid: v })} />
          <Knob label="Low dB" value={eq.low} min={-24} max={12} step={0.5} onChange={(v) => setEq({ ...eq, low: v })} />
          <Knob label="Channel" value={eq.fader} min={0} max={1} onChange={(v) => setEq({ ...eq, fader: v })} />
          <Knob label="Pitch %" value={pitch * 100} min={-8} max={8} step={0.1} onChange={(v) => setPitch(Math.abs(v) < 0.1 ? 0 : v / 100)} tone="ncvr-range-gold" />
        </div>
        <MeterBar meter={meter} label={label.slice(-1)} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="label">Load from library (approved)</span>
          <select className="field text-sm" disabled={disabled || loading} defaultValue="" onChange={(e) => {
            const t = library.find((x) => x.id === e.target.value);
            if (t) load(`/api/studio/library/${t.id}/audio`, t.title, t.artistName, t.id);
            e.target.value = "";
          }}>
            <option value="">{library.length ? "Choose a track…" : "No approved tracks yet"}</option>
            {library.map((t) => <option key={t.id} value={t.id}>{t.artistName} — {t.title}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="label">…or a local file</span>
          <input type="file" accept="audio/*" className="field text-xs" disabled={disabled || loading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f, f.name.replace(/\.[^.]+$/, ""), ""); }} />
        </label>
      </div>
      {loading && <p className="mt-2 text-xs text-[var(--color-muted)]">Loading & analysing…</p>}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </section>
  );
}


/** On-screen record: drag around the centre to scratch. */
function Platter({ deck, enabled }: { deck: Deck | null; enabled: boolean }) {
  const disc = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      if (disc.current && deck) disc.current.style.transform = `rotate(${((deck.position / 1.8) * 360) % 360}deg)`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [deck]);

  function angle(e: RPointerEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }
  const usable = enabled && !!deck?.scratchReady;

  return (
    <div
      role="slider"
      aria-label={`Deck ${deck?.id ?? ""} record — drag to scratch`}
      aria-valuenow={Math.round(deck?.position ?? 0)}
      aria-valuemin={0}
      aria-valuemax={Math.round(deck?.duration || 0)}
      tabIndex={usable ? 0 : -1}
      onPointerDown={(e) => {
        if (!usable || !deck?.beginScratch()) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = angle(e);
      }}
      onPointerMove={(e) => {
        if (last.current === null || !deck) return;
        const a = angle(e);
        deck.scratchBy(angleToSeconds(a - last.current));
        last.current = a;
      }}
      onPointerUp={() => { if (last.current !== null) { last.current = null; deck?.endScratch(); } }}
      onPointerCancel={() => { if (last.current !== null) { last.current = null; deck?.endScratch(); } }}
      className={`relative h-20 w-20 shrink-0 touch-none select-none rounded-full border border-white/15 bg-[radial-gradient(circle,#222_0%,#0b0b0b_60%,#1a1a1a_61%,#050505_100%)] ${usable ? "cursor-grab active:cursor-grabbing" : "opacity-50"}`}
    >
      <div ref={disc} className="absolute inset-0 rounded-full">
        <span className="absolute left-1/2 top-1 h-4 w-1 -translate-x-1/2 rounded bg-[var(--color-gold)]" />
      </div>
      <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-signal)]/70" />
    </div>
  );
}
