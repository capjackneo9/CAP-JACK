"use client";
import Link from "next/link";
import { usePlayer } from "./PlayerProvider";
import { PlayButton, StatusPill, VolumeControl } from "./controls";
import { Equalizer } from "../ui/Equalizer";

/** Persistent bottom player shown on every public page. */
export function PlayerBar() {
  const { state, np } = usePlayer();
  const t = np?.nowPlaying?.track;
  const playing = state.status === "playing";
  return (
    <div role="region" aria-label="Live radio player" className="glass-strong fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 px-3 py-2 sm:inset-x-4 sm:gap-4 sm:px-4">
      <PlayButton size={46} />
      <div className="hidden h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 sm:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t?.art || "/brand/ncvr-emblem-192.png"} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Equalizer active={playing} bars={4} />
          <StatusPill />
        </div>
        <div className="truncate text-sm font-semibold">
          {t ? <>{t.title} <span className="text-[var(--color-muted)]">— {t.artist}</span></> : np?.configured ? "Waiting for track data…" : "Live stream not connected yet"}
        </div>
        {np?.program && <div className="truncate text-xs text-[var(--color-gold)]">{np.program.title}{np.program.host ? ` · ${np.program.host}` : ""}</div>}
        {state.error && state.status !== "playing" && <div className="truncate text-xs text-red-300">{state.error}</div>}
      </div>
      <div className="hidden md:block"><VolumeControl /></div>
      <Link href="/radio/listen" className="btn btn-ghost hidden px-3 py-1.5 text-xs sm:inline-flex">Full player</Link>
    </div>
  );
}
