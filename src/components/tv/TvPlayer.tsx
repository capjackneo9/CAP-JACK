"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerProvider";

type Item =
  | { type: "video"; id: string; title: string; artist: string; src: string; durationSec: number; feature?: boolean }
  | { type: "commercial"; id: string; title: string; advertiser: string; src: string; durationSec: number }
  | { type: "card" };
type Block = { title: string; kind: string; label: string } | null;
type Look = { bugSrc: string; position: "top-left" | "top-right" | "bottom-left" | "bottom-right"; size: "sm" | "md" | "lg"; opacity: number };
type Now =
  | { mode: "live"; hlsUrl: string; serverTime: number; look?: Look }
  | { mode: "rotation"; serverTime: number; item: Item; offsetSec: number; remainingSec: number; breakRemainingSec?: number; next: Array<{ title: string; artist: string }>; block: Block; look?: Look }
  | { mode: "off"; reason: string; block?: Block; look?: Look }
  | { mode: "soon"; serverTime: number; look?: Look; soon: { title: string; logo: string | null; when: string } };

const BUG_POS = { "top-left": "left-3 top-3", "top-right": "right-3 top-3", "bottom-left": "bottom-14 left-3", "bottom-right": "bottom-14 right-3" } as const;
const BUG_SIZE = { sm: "w-14 sm:w-24", md: "w-20 sm:w-36", lg: "w-28 sm:w-52" } as const;

/**
 * NCVR TV — synchronized channel: music videos / scheduled blocks, commercial
 * breaks, and the live feed when a host broadcasts. Starts muted (autoplay
 * rules); unmuting pauses the radio player.
 */
export function TvPlayer({ bugSrc = "/brand/ncvr-emblem.webp", previewId }: { bugSrc?: string; previewId?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const hls = useRef<{ destroy: () => void } | null>(null);
  const cardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState<Now | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [muted, setMuted] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCaption, setShowCaption] = useState(true);
  const [retro, setRetro] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [touch, setTouch] = useState(false);
  const radio = usePlayer();

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /** Full screen: the whole TV frame (keeps logo/captions); iPhone falls back to native video full screen. */
  async function enterFullscreen() {
    const el = video.current;
    const w = wrap.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      if (w?.requestFullscreen) await w.requestFullscreen();
      else if (w?.webkitRequestFullscreen) w.webkitRequestFullscreen();
      else (el as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await o?.lock?.("landscape").catch(() => null);
    } catch { (el as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.(); }
  }
  function exitFullscreen() { if (document.fullscreenElement) document.exitFullscreen().catch(() => null); }

  /** Tap on the picture: unmute + full screen on phones/tablets. */
  function onScreenTap() {
    if (muted) toggleSound();
    if (touch && !isFs) enterFullscreen();
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tv/now${previewId ? `?preview=${encodeURIComponent(previewId)}` : ""}`, { cache: "no-store" });
      const j = (await r.json()) as Now;
      setNow(j);
      setFetchedAt(performance.now());
      setErr(null);
    } catch {
      setErr("Could not reach NCVR TV. Retrying…");
      setTimeout(load, 5000);
    }
  }, [previewId]);

  useEffect(() => { load(); }, [load]);

  // Switch to/from the live feed automatically.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/tv/now", { cache: "no-store" });
        const j = (await r.json()) as Now;
        setNow((cur) => ((cur?.mode === "live") !== (j.mode === "live") ? (setFetchedAt(performance.now()), j) : cur));
      } catch { /* keep playing */ }
    }, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el || !now) return;
    hls.current?.destroy();
    hls.current = null;
    if (cardTimer.current) clearTimeout(cardTimer.current);

    if (now.mode === "rotation" && now.item.type === "card") {
      el.pause();
      el.removeAttribute("src");
      el.load();
      const ms = Math.max(1000, now.remainingSec * 1000);
      setCountdown(Math.ceil(now.breakRemainingSec ?? now.remainingSec));
      cardTimer.current = setTimeout(load, ms);
      return;
    }
    if (now.mode === "rotation" && now.item.type !== "card") {
      const item = now.item;
      el.src = item.src;
      const sync = () => {
        const elapsed = (performance.now() - fetchedAt) / 1000;
        el.currentTime = Math.min(now.offsetSec + elapsed, Math.max(0, item.durationSec - 0.5));
        el.play().catch(() => setErr("Tap “Tap for sound” to start NCVR TV"));
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
          const h = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, liveMaxLatencyDurationCount: 5, backBufferLength: 30 });
          h.loadSource(now.hlsUrl);
          h.attachMedia(el);
          h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { setErr("Live feed interrupted — reconnecting…"); setTimeout(load, 4000); } });
          hls.current = h;
          el.play().catch(() => null);
        });
      }
    }
    if (now.mode === "off" || now.mode === "soon") { el.pause(); el.removeAttribute("src"); el.load(); }
  }, [now, fetchedAt, load]);

  useEffect(() => () => { hls.current?.destroy(); if (cardTimer.current) clearTimeout(cardTimer.current); }, []);

  // Bumper countdown
  useEffect(() => {
    if (!(now?.mode === "rotation" && now.item.type === "card")) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [now]);

  // MTV-style lower third: first 8 s and last 8 s of each video.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const onTime = () => {
      if (!(now?.mode === "rotation" && now.item.type === "video")) return setShowCaption(true);
      setShowCaption(el.currentTime < 8 || el.duration - el.currentTime < 8);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [now]);

  function toggleSound() {
    const el = video.current;
    if (!el) return;
    const next = !muted;
    if (!next) radio.pause();
    el.muted = next;
    setMuted(next);
    el.play().catch(() => null);
  }

  const item = now?.mode === "rotation" ? now.item : null;
  const block = now && "block" in now ? now.block : null;
  const look: Look = now?.look ?? { bugSrc, position: "top-right", size: bugSrc.includes("tv-logo") ? "md" : "sm", opacity: 85 };
  const badgeSide = look.position === "top-left" ? "right-3" : "left-3";

  return (
    <div className="space-y-4">
      <div ref={wrap} className={`relative overflow-hidden bg-black ${isFs ? "flex h-full w-full items-center" : "rounded-2xl border border-[var(--color-royal-400)]/40 shadow-[var(--shadow-glow-royal)]"}`}>
        <video ref={video} className={isFs ? "h-full w-full object-contain" : "aspect-video w-full bg-black"} muted={muted} playsInline autoPlay onEnded={load} aria-label="NCVR TV" controls={false} />
        {/* Tap the picture: sound on + full screen (phones) — double-click on computers */}
        <button type="button" aria-label={touch ? "Tap for sound and full screen" : "Click for sound, double-click for full screen"}
          className="absolute inset-0 z-[1] cursor-pointer bg-transparent" onClick={onScreenTap}
          onDoubleClick={() => (isFs ? exitFullscreen() : enterFullscreen())} />
        {retro && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_2px,transparent_4px)] mix-blend-multiply" />}
        {item?.type !== "card" && now?.mode !== "soon" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={look.bugSrc} alt="" style={{ opacity: look.opacity / 100 }}
            className={`pointer-events-none absolute z-[2] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] ${BUG_POS[look.position]} ${BUG_SIZE[look.size]}`} />
        )}
        {now?.mode === "live" && <div className={`pointer-events-none absolute z-[2] ${badgeSide} top-3 rounded bg-[var(--color-live)] px-2.5 py-1 text-xs font-black tracking-widest text-white shadow-[var(--shadow-glow-live)]`}>● LIVE</div>}
        {item?.type === "video" && (block || item.feature) && <div className={`pointer-events-none absolute z-[2] ${badgeSide} top-3 rounded bg-[var(--color-gold)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-midnight)] sm:text-xs`}>{item.feature ? "Feature presentation" : block?.title}</div>}
        {item?.type === "commercial" && (
          <div className={`pointer-events-none absolute z-[2] ${badgeSide} top-3 rounded bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs`}>
            Advertisement{item.advertiser ? ` · ${item.advertiser}` : ""}
          </div>
        )}
        {item?.type === "video" && showCaption && (
          <div className={`pointer-events-none absolute z-[2] bottom-14 max-w-[80%] font-[family-name:var(--font-display)] sm:bottom-16 leading-tight text-white ${look.position === "bottom-left" ? "right-4 text-right" : "left-4 sm:left-8"}`} style={{ textShadow: "2px 2px 0 #000, 0 0 12px rgba(0,0,0,0.9)" }}>
            <div className="text-lg font-black uppercase sm:text-3xl">{item.artist}</div>
            <div className="text-sm sm:text-xl">&ldquo;{item.title}&rdquo;</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)] sm:text-xs">{item.feature ? "Feature presentation" : block ? block.title : "NCVR TV"}</div>
          </div>
        )}
        {item?.type === "card" && (
          <div className="pointer-events-none absolute inset-0 z-[2] grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#1b0b4a_0%,#070B1E_75%)] p-6 text-center">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={look.bugSrc} alt="NCVR TV" className="mx-auto w-3/4 max-w-md drop-shadow-[0_0_30px_rgba(140,60,255,0.5)]" />
              <p className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-[0.3em] text-white sm:text-2xl">We&apos;ll be right back</p>
              {countdown > 0 && <p className="mt-1 font-mono text-sm text-[var(--color-gold)]">{countdown}s</p>}
            </div>
          </div>
        )}
        {now?.mode === "soon" && (
          <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-[2%] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#3b0d6b_0%,#120a3a_45%,#070B1E_80%)] p-[4%] text-center">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(2px_2px_at_20%_30%,#fff8,transparent),radial-gradient(2px_2px_at_70%_20%,#ffd70099,transparent),radial-gradient(1.5px_1.5px_at_85%_70%,#fff8,transparent),radial-gradient(2px_2px_at_35%_80%,#ff00a899,transparent),radial-gradient(1.5px_1.5px_at_55%_55%,#39ff1488,transparent)] motion-safe:animate-pulse" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={now.soon.logo ?? look.bugSrc} alt={now.soon.title} className="relative max-h-[62%] min-h-0 w-auto max-w-[70%] object-contain drop-shadow-[0_0_30px_rgba(160,60,255,0.6)]" />
            <p className="relative font-[family-name:var(--font-display)] text-xl font-black uppercase leading-none tracking-[0.3em] text-[var(--color-gold)] drop-shadow-[0_0_12px_rgba(212,175,55,0.6)] sm:text-5xl">Coming soon</p>
            <p className="relative font-mono text-[9px] uppercase tracking-[0.2em] text-white/80 sm:text-sm">{now.soon.when}</p>
          </div>
        )}
        {now?.mode === "off" && (
          <div className="pointer-events-none absolute inset-0 z-[2] grid place-items-center p-6 text-center">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={look.bugSrc} alt="" className="mx-auto w-48 opacity-90" />
              <p className="mt-4 text-[var(--color-muted)]">{now.reason}</p>
            </div>
          </div>
        )}
        {now && now.mode !== "off" && now.mode !== "soon" && (
          <div className="absolute bottom-2 right-2 z-[3] flex gap-2">
            <button type="button" onClick={toggleSound} className="btn btn-gold px-3 py-1.5 text-xs">{muted ? "🔊 Tap for sound" : "Mute"}</button>
            {isFs
              ? <button type="button" onClick={exitFullscreen} className="btn btn-ghost bg-black/60 px-3 py-1.5 text-xs">Exit full screen</button>
              : <button type="button" onClick={enterFullscreen} className="btn btn-ghost bg-black/50 px-3 py-1.5 text-xs">Full screen</button>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {now?.mode === "live" && <span className="font-semibold text-[var(--color-live)]">Live from the NCVR studio</span>}
        {item?.type === "video" && <span>Now: <strong>{item.artist}</strong> — {item.title}</span>}
        {item && item.type !== "video" && <span className="text-[var(--color-muted)]">Commercial break</span>}
        {touch && <span className="text-xs text-[var(--color-gold)]">Tap the screen for full screen</span>}
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <input type="checkbox" checked={retro} onChange={(e) => setRetro(e.target.checked)} className="accent-[var(--color-gold)]" /> Retro scanlines
        </label>
      </div>
      {now?.mode === "rotation" && now.next.length > 0 && (
        <div className="glass p-4">
          <div className="kicker mb-2">Coming up{block ? ` · ${block.title}` : ""}</div>
          <ol className="space-y-1 text-sm">{now.next.map((n, i) => <li key={i}><strong>{n.artist}</strong> — {n.title}</li>)}</ol>
        </div>
      )}
      {err && <p role="status" className="text-sm text-[var(--color-gold)]">{err}</p>}
    </div>
  );
}
