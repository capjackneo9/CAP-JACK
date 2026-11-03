"use client";
import { useEffect, useState } from "react";
import type { Deck } from "@/lib/audio/engine";
import { Knob, MeterBar, Waveform, fmtTime } from "./parts";
import type { Meter } from "@/lib/audio/engine";
import { usePresetSlot } from "./presets";
import { useConsoleControl } from "./controlBus";
import { scaleRange } from "@/lib/audio/midi";

export interface LibraryTrack { id: string; title: string; artistName: string; category: string }

export function DeckPanel({ deck, meter, library, label, sub, onLoaded }: { deck: Deck | null; meter?: Meter; library: LibraryTrack[]; label: string; sub: string; onLoaded?: (title: string, artist: string) => void }) {
  const [, force] = useState(0);
  const [eq, setEq] = useState({ low: 0, mid: 0, high: 0, filter: 0, trim: 1, fader: 0.8 });
  const [cue, setCue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);

  usePresetSlot(deck?.id === "B" ? "deckB" : "deckA", { ...eq, cue, trackId }, async (v) => {
    setEq({ trim: v.trim, filter: v.filter, low: v.low, mid: v.mid, high: v.high, fader: v.fader });
    setCue(v.cue);
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

  const el = deck?.el;
  const progress = el && el.duration ? el.currentTime / el.duration : 0;
  const disabled = !deck;

  // DJ controller
  useConsoleControl([deck?.id === "B" ? "deckB" : "deckA"], (a) => {
    if (!deck) return;
    const param = a.target.split(".")[1];
    if (a.kind === "range" && ["trim", "filter", "low", "mid", "high", "fader"].includes(param)) {
      setEq((prev) => ({ ...prev, [param]: scaleRange(a.target, a.value) }));
    } else if (a.kind === "button" && param === "play") {
      if (deck.el.src) { if (deck.playing) deck.pause(); else deck.play().catch((e) => setErr(e.message)); }
    } else if (a.kind === "button" && param === "cue") {
      deck.pause(); deck.el.currentTime = 0;
    } else if (a.kind === "button" && param === "pfl") {
      setCue((c) => !c);
    } else if (a.kind === "jog" && deck.el.duration) {
      const step = deck.playing ? 0.02 : 0.1; // nudge while playing, scrub while paused
      deck.el.currentTime = Math.min(Math.max(0, deck.el.currentTime + a.delta * step), deck.el.duration - 0.05);
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
      <div className="mt-2"><Waveform peaks={deck?.peaks ?? null} progress={progress} onSeek={(p) => { if (el?.duration) el.currentTime = p * el.duration; }} /></div>
      <div className="mt-1 flex justify-between font-mono text-xs text-[var(--color-muted)]"><span>{fmtTime(el?.currentTime ?? 0)}</span><span>-{fmtTime((el?.duration ?? 0) - (el?.currentTime ?? 0))}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary px-4 py-1.5 text-sm" disabled={disabled || !el?.src}
          onClick={() => (deck!.playing ? deck!.pause() : deck!.play().catch((e) => setErr(e.message)))}>{deck?.playing ? "Pause" : "Play"}</button>
        <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" disabled={disabled || !el?.src} onClick={() => { if (el) { el.pause(); el.currentTime = 0; } }}>Cue to start</button>
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
