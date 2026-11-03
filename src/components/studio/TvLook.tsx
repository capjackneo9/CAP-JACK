"use client";
import { useState } from "react";
import { formatMinute } from "@/lib/schedule";

export type Pos = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Size = "sm" | "md" | "lg";
export const POSITIONS: Array<[Pos, string]> = [["top-left", "Top left"], ["top-right", "Top right"], ["bottom-left", "Bottom left"], ["bottom-right", "Bottom right"]];
export const SIZES: Array<[Size, string]> = [["sm", "Small"], ["md", "Medium"], ["lg", "Large"]];
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function uploadTvImage(file: File): Promise<string> {
  const fd = new FormData(); fd.append("image", file);
  const r = await fetch("/api/studio/tv/image", { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Upload failed");
  return j.path;
}

/** Mini TV showing where the logo will sit. */
export function ScreenPreview({ src, position, size, opacity = 85 }: { src: string; position: Pos; size: Size; opacity?: number }) {
  const pos = { "top-left": "left-2 top-2", "top-right": "right-2 top-2", "bottom-left": "bottom-2 left-2", "bottom-right": "bottom-2 right-2" }[position];
  const w = { sm: "w-[18%]", md: "w-[28%]", lg: "w-[40%]" }[size];
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/15 bg-[linear-gradient(135deg,#1a1f4a,#3b0d4a)]" aria-label="Screen preview">
      <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-widest text-white/30">Video</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`absolute ${pos} ${w}`} style={{ opacity: opacity / 100 }} />
    </div>
  );
}

export interface LookSettings { bugPath: string | null; bugPosition: Pos; bugSize: Size; bugOpacity: number; layout: "logo-top" | "player-top" }

export function ScreenLookPanel({ initial, onMsg }: { initial: LookSettings; onMsg: (m: { tone: "ok" | "err"; text: string }) => void }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function save(next = v) {
    const r = await fetch("/api/studio/tv/settings", json("PUT", next));
    const j = await r.json();
    onMsg(r.ok ? { tone: "ok", text: "Screen look saved — viewers see it within a few seconds." } : { tone: "err", text: j.error });
  }
  return (
    <section className="glass grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_240px]" aria-label="Screen logo and layout">
      <div className="space-y-3">
        <div className="kicker">Screen logo &amp; layout (whole channel)</div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label><span className="label">On-screen logo</span>
            <input type="file" accept="image/png,image/webp,image/jpeg" className="field text-xs" disabled={busy} onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setBusy(true);
              try { const path = await uploadTvImage(f); const next = { ...v, bugPath: path }; setV(next); await save(next); } catch (er) { onMsg({ tone: "err", text: (er as Error).message }); }
              setBusy(false);
            }} /></label>
          {v.bugPath && <button type="button" className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => { const next = { ...v, bugPath: null }; setV(next); save(next); }}>Use NCVR TV logo</button>}
          <label><span className="label">Position</span>
            <select className="field w-auto" value={v.bugPosition} onChange={(e) => setV({ ...v, bugPosition: e.target.value as Pos })}>{POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="label">Size</span>
            <select className="field w-auto" value={v.bugSize} onChange={(e) => setV({ ...v, bugSize: e.target.value as Size })}>{SIZES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="w-36"><span className="label">Opacity {v.bugOpacity}%</span>
            <input type="range" min={20} max={100} value={v.bugOpacity} onChange={(e) => setV({ ...v, bugOpacity: Number(e.target.value) })} className="ncvr-range-gold w-full" /></label>
          <label><span className="label">TV page layout</span>
            <select className="field w-auto" value={v.layout} onChange={(e) => setV({ ...v, layout: e.target.value as LookSettings["layout"] })}>
              <option value="logo-top">Big logo above the screen</option>
              <option value="player-top">Screen first (logo beside the title)</option>
            </select></label>
          <button type="button" className="btn btn-primary px-4 py-1.5 text-sm" onClick={() => save()}>Save look</button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">Tip: use a PNG with a transparent background. Blocks can use their own logo (e.g. Saturday Vibe Amerime) — set it under the block&apos;s Edit.</p>
      </div>
      <ScreenPreview src={v.bugPath ?? "/brand/ncvr-tv-logo.webp"} position={v.bugPosition} size={v.bugSize} opacity={v.bugOpacity} />
    </section>
  );
}

export interface BlockFull {
  id: string; title: string; days: number[]; startMinute: number; endMinute: number; kind: string; commercials: boolean; active: boolean;
  breakEvery: number | null; breakSeconds: number | null; logoPath: string | null; logoPosition: Pos | null; logoSize: Size | null;
  featureVideoId: string | null; featureStartMinute: number | null; featureDate: string | null;
}
interface Vid { id: string; kind: string; title: string; artistName: string; durationSec: number; status: string }

/** Per-block settings: logo, break timing, feature presentation — with format math. */
export function BlockEditor({ block, videos, channel, onSaved, onMsg }: {
  block: BlockFull; videos: Vid[]; channel: { breakEvery: number; breakSeconds: number };
  onSaved: () => void; onMsg: (m: { tone: "ok" | "err"; text: string }) => void;
}) {
  const [b, setB] = useState(block);
  const [busy, setBusy] = useState(false);
  const episodes = videos.filter((v) => v.kind === b.kind && v.status === "APPROVED");
  const features = videos.filter((v) => ["CARTOON", "PROGRAM", "MOVIE"].includes(v.kind) && v.status === "APPROVED");
  const feature = features.find((f) => f.id === b.featureVideoId);
  const blockMin = b.endMinute - b.startMinute;
  const every = b.breakEvery ?? channel.breakEvery;
  const brk = (b.breakSeconds ?? channel.breakSeconds) / 60;
  const avg = episodes.length ? episodes.reduce((n, v) => n + v.durationSec, 0) / episodes.length / 60 : 7; // assume 7-min shows until episodes are uploaded
  const featureMin = feature ? Math.ceil(feature.durationSec / 60) : 0;
  const avail = blockMin - featureMin;
  const perShow = avg + (b.commercials ? brk / every : 0);
  const fit = Math.floor((avail + 1e-6) / perShow);
  const featureTimes = Array.from({ length: Math.floor(blockMin / 5) }, (_, i) => b.startMinute + i * 5);

  async function save() {
    setBusy(true);
    const r = await fetch(`/api/studio/tv/blocks/${b.id}`, json("PATCH", {
      breakEvery: b.breakEvery, breakSeconds: b.breakSeconds, logoPath: b.logoPath, logoPosition: b.logoPosition, logoSize: b.logoSize,
      featureVideoId: b.featureVideoId, featureStartMinute: b.featureVideoId ? b.featureStartMinute : null, featureDate: b.featureVideoId ? b.featureDate : null,
    }));
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return onMsg({ tone: "err", text: j.error });
    onMsg({ tone: "ok", text: `“${b.title}” saved.` });
    onSaved();
  }

  return (
    <div className="mt-3 grid gap-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="kicker text-[10px]">Block logo</div>
        <ScreenPreview src={b.logoPath ?? "/brand/ncvr-tv-logo.webp"} position={b.logoPosition ?? "top-right"} size={b.logoSize ?? "md"} />
        <input type="file" accept="image/png,image/webp,image/jpeg" className="field text-xs" disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try { setB({ ...b, logoPath: await uploadTvImage(f), logoPosition: b.logoPosition ?? "top-left", logoSize: b.logoSize ?? "md" }); } catch (er) { onMsg({ tone: "err", text: (er as Error).message }); }
        }} />
        <div className="flex gap-2">
          <select aria-label="Logo position" className="field" value={b.logoPosition ?? "top-left"} onChange={(e) => setB({ ...b, logoPosition: e.target.value as Pos })}>{POSITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select aria-label="Logo size" className="field" value={b.logoSize ?? "md"} onChange={(e) => setB({ ...b, logoSize: e.target.value as Size })}>{SIZES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        {b.logoPath && <button type="button" className="text-[var(--color-muted)] underline" onClick={() => setB({ ...b, logoPath: null })}>Use channel logo instead</button>}
      </div>

      <div className="space-y-2">
        <div className="kicker text-[10px]">Commercial timing</div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={b.breakEvery == null} className="accent-[var(--color-gold)]"
          onChange={(e) => setB({ ...b, breakEvery: e.target.checked ? null : channel.breakEvery, breakSeconds: e.target.checked ? null : channel.breakSeconds })} />
          Same as channel ({channel.breakEvery} video{channel.breakEvery > 1 ? "s" : ""} / {channel.breakSeconds}s)</label>
        {b.breakEvery != null && (
          <div className="flex gap-2">
            <label className="flex-1"><span className="label">Break after every</span>
              <select className="field" value={b.breakEvery} onChange={(e) => setB({ ...b, breakEvery: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} show{n > 1 ? "s" : ""}</option>)}</select></label>
            <label className="flex-1"><span className="label">Break length</span>
              <select className="field" value={b.breakSeconds ?? 60} onChange={(e) => setB({ ...b, breakSeconds: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n >= 60 ? `${n / 60} min` : `${n} s`}</option>)}</select></label>
          </div>
        )}
        <div className="rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-2">
          <div className="font-semibold">Format check · {blockMin} min block</div>
          <div className="mt-1 text-[var(--color-muted)]">
            {featureMin ? `${featureMin}-min feature + ` : ""}≈{fit} shows of ~{avg.toFixed(1)} min{b.commercials ? ` with a ${brk}-min break every ${every}` : ""} fit.
            {" "}On air now: {episodes.length} {episodes.length === 1 ? "episode" : "episodes"}{episodes.length < fit ? " (episodes repeat to fill the block)" : ""}.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="kicker text-[10px]">Feature presentation (e.g. a 1-hour movie)</div>
        <select aria-label="Feature video" className="field" value={b.featureVideoId ?? ""} onChange={(e) => setB({ ...b, featureVideoId: e.target.value || null, featureStartMinute: b.featureStartMinute ?? b.startMinute })}>
          <option value="">No feature</option>
          {features.map((f) => <option key={f.id} value={f.id}>{f.title} ({Math.ceil(f.durationSec / 60)} min)</option>)}
        </select>
        {b.featureVideoId && (
          <>
            <label className="block"><span className="label">Starts at</span>
              <select className="field" value={b.featureStartMinute ?? b.startMinute} onChange={(e) => setB({ ...b, featureStartMinute: Number(e.target.value) })}>
                {featureTimes.map((t) => <option key={t} value={t}>{formatMinute(t)}</option>)}</select></label>
            <label className="block"><span className="label">Only on this date (leave empty = every week)</span>
              <input type="date" className="field" value={b.featureDate ?? ""} onChange={(e) => setB({ ...b, featureDate: e.target.value || null })} /></label>
          </>
        )}
        <p className="text-[10px] text-[var(--color-muted)]">Upload movies as type <strong>Movie</strong>. Episodes play before and after the feature.</p>
        <button type="button" className="btn btn-primary w-full py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save block"}</button>
      </div>
    </div>
  );
}
