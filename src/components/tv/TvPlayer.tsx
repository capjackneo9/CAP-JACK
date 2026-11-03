"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "../player/PlayerProvider";

type Item =
  | { type: "video"; id: string; title: string; artist: string; src: string; durationSec: number }
  | { type: "commercial"; id: string; title: string; advertiser: string; src: string; durationSec: number }
  | { type: "card" };
type Block = { title: string; kind: string; label: string } | null;
type Now =
  | { mode: "live"; hlsUrl: string; serverTime: number }
  | { mode: "rotation"; serverTime: number; item: Item; offsetSec: number; remainingSec: number; breakRemainingSec?: number; next: Array<{ title: string; artist: string }>; block: Block }
  | { mode: "off"; reason: string; block?: Block };

/**
 * NCVR TV — synchronized channel: music videos / scheduled blocks, commercial
 * breaks, and the live feed when a host broadcasts. Starts muted (autoplay
 * rules); unmuting pauses the radio player.
 */
export function TvPlayer({ bugSrc = "/brand/ncvr-emblem.webp" }: { bugSrc?: string }) {
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
      setTimeout(load, 5000);
    }
  }, []);

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

  return (
    <div className="space-y-4">
      <div ref={wrap} className="relative overflow-hidden rounded-2xl border border-[var(--color-royal-400)]/40 bg-black shadow-[var(--shadow-glow-royal)]">
        <video ref={video} className="aspect-video w-full bg-black" muted={muted} playsInline autoPlay onEnded={load} aria-label="NCVR TV" controls={false} />
        {retro && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.18)_0px,rgba(0,0,0,0.18)_1px,transparent_2px,transparent_4px)] mix-blend-multiply" />}
        {item?.type !== "card" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bugSrc} alt="" className={`pointer-events-none absolute right-3 top-3 opacity-80 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] ${bugSrc.includes("tv-logo") ? "w-24 sm:w-36" : "w-14 sm:w-20"}`} />
        )}
        {now?.mode === "live" && <div className="absolute left-3 top-3 rounded bg-[var(--color-live)] px-2.5 py-1 text-xs font-black tracking-widest text-white shadow-[var(--shadow-glow-live)]">● LIVE</div>}
        {block && item?.type === "video" && <div className="absolute left-3 top-3 rounded bg-[var(--color-gold)] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-midnight)] sm:text-xs">{block.title}</div>}
        {item?.type === "commercial" && (
          <div className="absolute left-3 top-3 rounded bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white sm:text-xs">
            Advertisement{item.advertiser ? ` · ${item.advertiser}` : ""}
          </div>
        )}
        {item?.type === "video" && showCaption && (
          <div className="absolute bottom-6 left-4 max-w-[80%] font-[family-name:var(--font-display)] leading-tight text-white [text-shadow:2px_2px_0_#000,0_0_12px_rgba(0,0,0,0.9)] sm:bottom-10 sm:left-8">
            <div className="text-lg font-black uppercase sm:text-3xl">{item.artist}</div>
            <div className="text-sm sm:text-xl">&ldquo;{item.title}&rdquo;</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-gold)] sm:text-xs">{block ? block.title : "NCVR TV"}</div>
          </div>
        )}
        {item?.type === "card" && (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#1b0b4a_0%,#070B1E_75%)] p-6 text-center">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bugSrc} alt="NCVR TV" className="mx-auto w-3/4 max-w-md drop-shadow-[0_0_30px_rgba(140,60,255,0.5)]" />
              <p className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold uppercase tracking-[0.3em] text-white sm:text-2xl">We&apos;ll be right back</p>
              {countdown > 0 && <p className="mt-1 font-mono text-sm text-[var(--color-gold)]">{countdown}s</p>}
            </div>
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
        {item?.type === "video" && <span>Now: <strong>{item.artist}</strong> — {item.title}</span>}
        {item && item.type !== "video" && <span className="text-[var(--color-muted)]">Commercial break</span>}
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
