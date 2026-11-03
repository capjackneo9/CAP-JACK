"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerProvider";

type Now =
  | { mode: "live"; hlsUrl: string; serverTime: number }
  | { mode: "rotation"; serverTime: number; video: { id: string; title: string; artist: string; src: string; durationSec: number }; offsetSec: number; remainingSec: number; next: Array<{ title: string; artist: string }> }
  | { mode: "off"; reason: string };

/**
 * NCVR TV — synchronized music-video channel that switches to the live feed
 * whenever a host is broadcasting video. Starts muted (browser autoplay rules);
 * unmuting pauses the radio player so the two never play over each other.
 */
export function TvPlayer({ bugSrc = "/brand/ncvr-emblem.webp" }: { bugSrc?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hls = useRef<{ destroy: () => void } | null>(null);
  const [now, setNow] = useState<Now | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [muted, setMuted] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCaption, setShowCaption] = useState(true);
  const [retro, setRetro] = useState(true);
  const radio = usePlayer();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tv/now", { cache: "no-store" });
      const j = (await r.json()) as Now;
      setNow(j);
      setFetchedAt(performance.now());
      setErr(null);
    } catch {
      setErr("Could not reach NCVR TV. Retrying…");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-check every 20s so viewers switch to/from the live feed automatically.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/tv/now", { cache: "no-store" });
        const j = (await r.json()) as Now;
        setNow((cur) => (cur?.mode !== j.mode ? (setFetchedAt(performance.now()), j) : cur));
      } catch { /* keep playing */ }
    }, 20000);
    return () => clearInterval(id);
  }, []);

  // Attach the source for the current mode.
  useEffect(() => {
    const el = video.current;
    if (!el || !now) return;
    hls.current?.destroy();
    hls.current = null;
    if (now.mode === "rotation") {
      el.src = now.video.src;
      const sync = () => {
        const elapsed = (performance.now() - fetchedAt) / 1000;
        el.currentTime = Math.min(now.offsetSec + elapsed, Math.max(0, now.video.durationSec - 1));
        el.play().catch(() => setErr("Tap play to start NCVR TV"));
      };
      el.addEventListener("loadedmetadata", sync, { once: true });
      return () => el.removeEventListener("loadedmetadata", sync);
    }
    if (now.mode === "live") {
      if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = now.hlsUrl;
        el.play().catch(() => null);
      } else {
        import("hls.js").then(({ default: Hls }) => {
          if (!Hls.isSupported()) { setErr("This browser cannot play the live feed."); return; }
          const h = new Hls({ liveSyncDurationCount: 3 });
          h.loadSource(now.hlsUrl);
          h.attachMedia(el);
          h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { setErr("Live feed interrupted — reconnecting…"); setTimeout(load, 4000); } });
          hls.current = h;
          el.play().catch(() => null);
        });
      }
    }
    if (now.mode === "off") el.removeAttribute("src");
  }, [now, fetchedAt, load]);

  useEffect(() => () => hls.current?.destroy(), []);

  // MTV-style lower third: first 8s and last 8s of each video.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const onTime = () => {
      if (now?.mode !== "rotation") return setShowCaption(true);
      setShowCaption(el.currentTime < 8 || el.duration - el.currentTime < 8);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [now]);

  function toggleSound() {
    const el = video.current;
    if (!el) return;
    const next = !muted;
    if (!next) radio.pause(); // don't play radio and TV at once
    el.muted = next;
    setMuted(next);
    el.play().catch(() => null);
  }

  return (
    <div className="space-y-4">
      <div ref={wrap} className="relative overflow-hidden rounded-2xl border border-[var(--color-royal-400)]/40 bg-black shadow-[var(--shadow-glow-royal)]">
        <video ref={video} className="aspect-video w-full bg-black" muted={muted} playsInline autoPlay
          onEnded={load} aria-label="NCVR TV" controls={false} />
        {retro && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_2px,transparent_4px)] mix-blend-multiply" />}
        {/* Channel bug */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bugSrc} alt="" className={`pointer-events-none absolute right-3 top-3 opacity-80 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] ${bugSrc.includes("tv-logo") ? "w-24 sm:w-36" : "w-14 sm:w-20"}`} />
        {now?.mode === "live" && (
          <div className="absolute left-3 top-3 rounded bg-[var(--color-live)] px-2.5 py-1 text-xs font-black tracking-widest text-white shadow-[var(--shadow-glow-live)]">● LIVE</div>
        )}
        {now?.mode === "rotation" && showCaption && (
          <div className="absolute bottom-6 left-4 max-w-[80%] font-[family-name:var(--font-display)] leading-tight text-white [text-shadow:2px_2px_0_#000,0_0_12px_rgba(0,0,0,0.9)] sm:bottom-10 sm:left-8">
            <div className="text-lg font-black uppercase sm:text-3xl">{now.video.artist}</div>
            <div className="text-sm sm:text-xl">&ldquo;{now.video.title}&rdquo;</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)] sm:text-xs">NCVR TV</div>
          </div>
        )}
        {now?.mode === "off" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bugSrc} alt="" className="mx-auto w-48 opacity-90" />
              <p className="mt-4 text-[var(--color-muted)]">{now.reason}</p>
            </div>
          </div>
        )}
        {now && now.mode !== "off" && (
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button type="button" onClick={toggleSound} className="btn btn-gold px-3 py-1.5 text-xs">{muted ? "🔊 Tap for sound" : "Mute"}</button>
            <button type="button" onClick={() => wrap.current?.requestFullscreen?.()} className="btn btn-ghost bg-black/50 px-3 py-1.5 text-xs">Full screen</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {now?.mode === "live" && <span className="font-semibold text-[var(--color-live)]">Live from the NCVR studio</span>}
        {now?.mode === "rotation" && <span>Now: <strong>{now.video.artist}</strong> — {now.video.title}</span>}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} className="accent-[var(--color-gold)]" /> Retro scanlines
        </label>
      </div>
      {now?.mode === "rotation" && now.next.length > 0 && (
        <div className="glass p-4">
          <div className="kicker mb-2">Coming up</div>
          <ol className="space-y-1 text-sm">{now.next.map((n, i) => <li key={i}><strong>{n.artist}</strong> — {n.title}</li>)}</ol>
        </div>
      )}
      {err && <p role="status" className="text-sm text-[var(--color-gold)]">{err}</p>}
    </div>
  );
}
