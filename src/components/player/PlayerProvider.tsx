"use client";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { initialPlayerState, playerReducer, reconnectDelay, type PlayerState } from "@/lib/player/state";
import type { NowPlayingResponse } from "@/app/api/radio/nowplaying/route";

interface Ctx {
  state: PlayerState;
  np: NowPlayingResponse | null;
  npError: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}
const PlayerCtx = createContext<Ctx | null>(null);

export function usePlayer() {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return c;
}

const POLL_MS = 15_000;

/**
 * Lives in the /radio layout, so the <audio> element (and playback) survives
 * client-side navigation between public pages.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);
  const [np, setNp] = useState<NowPlayingResponse | null>(null);
  const [npError, setNpError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Now Playing polling
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/radio/nowplaying", { cache: "no-store" });
        const j = (await r.json()) as NowPlayingResponse;
        if (!alive) return;
        setNp(j);
        setNpError(j.error);
        dispatch({ type: "SET_STREAM", url: process.env.NEXT_PUBLIC_STREAM_URL || j.nowPlaying?.listenUrl || null });
      } catch (e) {
        if (alive) setNpError((e as Error).message);
      }
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Audio element lifecycle
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    a.crossOrigin = "anonymous";
    audio.current = a;
    const on = (ev: string, fn: () => void) => a.addEventListener(ev, fn);
    on("playing", () => dispatch({ type: "AUDIO_PLAYING" }));
    on("waiting", () => dispatch({ type: "AUDIO_WAITING" }));
    on("stalled", () => dispatch({ type: "AUDIO_WAITING" }));
    on("error", () => dispatch({ type: "AUDIO_ERROR", message: a.error?.message || "The stream could not be loaded" }));
    on("ended", () => dispatch({ type: "AUDIO_ERROR", message: "The stream ended unexpectedly" }));
    return () => { a.pause(); a.src = ""; audio.current = null; };
  }, []);

  // Drive the element from state
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = state.volume;
    a.muted = state.muted;
  }, [state.volume, state.muted]);

  useEffect(() => {
    const a = audio.current;
    if (!a || !state.streamUrl) return;
    if (state.status === "loading") {
      // Cache-bust so a reconnect gets a fresh live edge instead of stale buffer.
      const sep = state.streamUrl.includes("?") ? "&" : "?";
      a.src = `${state.streamUrl}${sep}_=${Date.now()}`;
      a.play().catch((e: Error) => dispatch({ type: "AUDIO_ERROR", message: e.name === "NotAllowedError" ? "Tap play to start the stream" : e.message }));
    } else if (state.status === "paused") {
      a.pause();
      a.removeAttribute("src");
      a.load(); // drop the live connection while paused
    } else if (state.status === "reconnecting") {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => dispatch({ type: "RECONNECT" }), reconnectDelay(state.reconnectAttempts));
    }
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, [state.status, state.streamUrl, state.reconnectAttempts]);

  // Media Session (lock screen / background controls where supported)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const t = np?.nowPlaying?.track;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t?.title ?? "Nite Cap Vibe Radio",
      artist: t?.artist ?? "NCVR",
      album: np?.program?.title ?? "NCVR · 24/7",
      artwork: [{ src: t?.art || "/brand/ncvr-logo.svg", sizes: "512x512" }],
    });
    navigator.mediaSession.setActionHandler("play", () => dispatch({ type: "PLAY" }));
    navigator.mediaSession.setActionHandler("pause", () => dispatch({ type: "PAUSE" }));
  }, [np]);

  const play = useCallback(() => dispatch({ type: "PLAY" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const toggle = useCallback(() => {
    dispatch({ type: ["playing", "loading", "buffering", "reconnecting"].includes(state.status) ? "PAUSE" : "PLAY" });
  }, [state.status]);
  const setVolume = useCallback((v: number) => dispatch({ type: "SET_VOLUME", volume: v }), []);
  const toggleMute = useCallback(() => dispatch({ type: "TOGGLE_MUTE" }), []);

  return <PlayerCtx.Provider value={{ state, np, npError, play, pause, toggle, setVolume, toggleMute }}>{children}</PlayerCtx.Provider>;
}
