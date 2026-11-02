"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Meter } from "@/lib/audio/engine";

export function MeterBar({ meter, label, vertical = true, tone = "signal" }: { meter?: Meter; label: string; vertical?: boolean; tone?: "signal" | "live" | "gold" }) {
  const db = meter ? 20 * Math.log10(Math.max(meter.peak, 1e-5)) : -60;
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const clip = meter && meter.peak >= 0.99;
  const color = clip ? "#ff3355" : tone === "live" ? "var(--color-live)" : tone === "gold" ? "var(--color-gold)" : "var(--color-signal)";
  return (
    <div className="flex flex-col items-center gap-1" role="meter" aria-label={`${label} level`} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(db)}>
      <div className={`relative overflow-hidden rounded bg-black/60 ${vertical ? "h-32 w-3" : "h-3 w-full"}`}>
        <div className="absolute bottom-0 left-0 transition-[height,width] duration-75" style={vertical ? { height: `${pct}%`, width: "100%", background: `linear-gradient(to top, ${color}, ${color} 70%, #ffd400 85%, #ff3355)` } : { width: `${pct}%`, height: "100%", background: color }} />
      </div>
      <span className="font-mono text-[10px] text-[var(--color-muted)]">{label}</span>
    </div>
  );
}

export function Knob({ label, value, min, max, step = 0.01, onChange, tone = "ncvr-range" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; tone?: string }) {
  const id = useRef(`k${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]"><span>{label}</span><span>{value.toFixed(2)}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={tone} />
    </div>
  );
}

export function Waveform({ peaks, progress, onSeek, color = "#39FF14" }: { peaks: Float32Array | null; progress: number; onSeek?: (p: number) => void; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = (c.width = c.clientWidth * 2);
    const h = (c.height = c.clientHeight * 2);
    ctx.clearRect(0, 0, w, h);
    if (!peaks) {
      ctx.fillStyle = "rgba(169,179,214,0.25)";
      ctx.fillRect(0, h / 2 - 1, w, 2);
      return;
    }
    const bw = w / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const v = peaks[i] * h * 0.95;
      ctx.fillStyle = i / peaks.length < progress ? color : "rgba(111,140,255,0.55)";
      ctx.fillRect(i * bw, (h - v) / 2, Math.max(1, bw - 0.5), v);
    }
    ctx.fillStyle = "#D4AF37";
    ctx.fillRect(progress * w - 1, 0, 2, h);
  }, [peaks, progress, color]);
  return (
    <canvas ref={ref} className="h-16 w-full cursor-pointer rounded bg-black/50" aria-label="Waveform — click to seek"
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek?.((e.clientX - r.left) / r.width); }} />
  );
}

/** Two-step confirmation for live-impacting actions: type the phrase to enable. */
export function ConfirmAction({ phrase, label, onConfirm, className = "btn btn-danger", disabled, children }: { phrase: string; label: string; onConfirm: () => Promise<void> | void; className?: string; disabled?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => { setText(""); setOpen(true); }}>{label}</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="glass-strong w-full max-w-md space-y-3 p-5">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">{label}</h3>
            {children}
            <label className="label" htmlFor="confirm-phrase">Type <strong className="text-white">{phrase}</strong> to confirm</label>
            <input id="confirm-phrase" autoFocus className="field" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className={className} disabled={text !== phrase || busy}
                onClick={async () => { setBusy(true); try { await onConfirm(); setOpen(false); } finally { setBusy(false); } }}>
                {busy ? "Working…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function fmtTime(s: number) {
  if (!Number.isFinite(s)) return "--:--";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
