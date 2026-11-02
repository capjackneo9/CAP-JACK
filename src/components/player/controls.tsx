"use client";
import { usePlayer } from "./PlayerProvider";
import { statusLabel } from "@/lib/player/state";

export function PlayButton({ size = 56 }: { size?: number }) {
  const { state, toggle } = usePlayer();
  const active = ["playing", "loading", "buffering", "reconnecting"].includes(state.status);
  const disabled = state.status === "unavailable";
  return (
    <button type="button" onClick={toggle} disabled={disabled}
      aria-label={active ? "Pause live stream" : "Play live stream"} aria-pressed={active}
      className="grid shrink-0 place-items-center rounded-full bg-[var(--color-royal)] text-white shadow-[var(--shadow-glow-royal)] transition hover:bg-[var(--color-royal-400)] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ width: size, height: size }}>
      {active ? (
        <svg width={size * 0.38} height={size * 0.38} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1" /><rect x="14" y="4" width="5" height="16" rx="1" /></svg>
      ) : (
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>
      )}
    </button>
  );
}

export function VolumeControl() {
  const { state, setVolume, toggleMute } = usePlayer();
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={toggleMute} aria-label={state.muted ? "Unmute" : "Mute"} aria-pressed={state.muted}
        className="rounded-full p-2 text-[var(--color-muted)] hover:text-white">
        {state.muted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
        )}
      </button>
      <label className="sr-only" htmlFor="ncvr-volume">Volume</label>
      <input id="ncvr-volume" type="range" min={0} max={1} step={0.01} value={state.muted ? 0 : state.volume}
        onChange={(e) => setVolume(Number(e.target.value))} className="ncvr-range w-24" />
    </div>
  );
}

export function StatusPill() {
  const { state, np } = usePlayer();
  const live = np?.nowPlaying?.live.isLive;
  const tone = state.status === "playing" ? "text-[var(--color-signal)]" : state.status === "error" ? "text-red-300" : "text-[var(--color-muted)]";
  return (
    <span className={`text-xs font-semibold ${tone}`} aria-live="polite">
      {statusLabel(state.status)}
      {live && <span className="ml-2 rounded bg-[var(--color-live)] px-1.5 py-0.5 text-[10px] text-white">LIVE DJ</span>}
    </span>
  );
}
