"use client";
import { usePlayer } from "./PlayerProvider";
import { PlayButton, StatusPill, VolumeControl } from "./controls";
import { Equalizer } from "../ui/Equalizer";

export function NowPlayingCard({ fallbackArt, large = false }: { fallbackArt?: React.ReactNode; large?: boolean }) {
  const { state, np, npError } = usePlayer();
  const n = np?.nowPlaying;
  const t = n?.track;
  return (
    <div className={`glass relative overflow-hidden p-5 ${large ? "sm:p-8" : ""}`}>
      <div className="kicker">NCVR // Now Playing</div>
      <div className={`mt-4 grid gap-5 ${large ? "md:grid-cols-[minmax(0,320px)_1fr]" : "sm:grid-cols-[140px_1fr]"}`}>
        <div className="relative">
          {t?.art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.art} alt={`Artwork for ${t.title}`} className="aspect-square w-full rounded-2xl border border-white/10 object-cover shadow-[var(--shadow-glow-royal)]" />
          ) : (
            fallbackArt ?? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/ncvr-logo.svg" alt="NCVR" className="aspect-square w-full rounded-2xl" />
            )
          )}
          {n?.live.isLive && (
            <span className="absolute left-2 top-2 rounded-full bg-[var(--color-live)] px-2.5 py-1 text-xs font-bold shadow-[var(--shadow-glow-live)]">● LIVE · {n.live.streamerName}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-3">
          {np?.program && (
            <div className="text-sm text-[var(--color-gold)]">
              {np.program.title}{np.program.host ? ` · hosted by ${np.program.host}` : ""}
            </div>
          )}
          <div>
            <h2 className={`font-[family-name:var(--font-display)] font-bold ${large ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
              {t ? t.title : np?.configured ? "Track data unavailable" : "Caprio Jackson Radio"}
            </h2>
            <p className="text-[var(--color-muted)]">
              {t ? t.artist : np?.configured ? "The broadcast server did not report a current track." : "24-hour music rotation — the live stream connects once the broadcast server is configured."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <PlayButton size={large ? 72 : 56} />
            <Equalizer active={state.status === "playing"} bars={7} />
            <StatusPill />
            <VolumeControl />
          </div>
          {n?.next && <p className="text-xs text-[var(--color-muted)]">Up next: {n.next.title}{n.next.artist ? ` — ${n.next.artist}` : ""}</p>}
          {typeof n?.listeners === "number" && <p className="text-xs text-[var(--color-signal)]">{n.listeners} listening now</p>}
          {npError && <p className="text-xs text-red-300">Broadcast server: {npError}</p>}
          {n && !n.online && <p className="text-xs text-red-300">The station is currently reported offline by the broadcast server.</p>}
        </div>
      </div>
    </div>
  );
}

export function RecentTracks() {
  const { np } = usePlayer();
  const recent = np?.nowPlaying?.recent ?? [];
  if (!np?.configured) return <p className="text-sm text-[var(--color-muted)]">Recently played tracks appear here once the broadcast server is connected.</p>;
  if (recent.length === 0) return <p className="text-sm text-[var(--color-muted)]">No play history reported yet.</p>;
  return (
    <ol className="divide-y divide-white/5">
      {recent.map((r, i) => (
        <li key={`${r.playedAt}-${i}`} className="flex items-center gap-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.art || "/brand/ncvr-logo.svg"} alt="" className="h-10 w-10 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{r.title}</div>
            <div className="truncate text-xs text-[var(--color-muted)]">{r.artist}</div>
          </div>
          <time className="text-xs text-[var(--color-muted)]" dateTime={r.playedAt}>
            {new Date(r.playedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </time>
        </li>
      ))}
    </ol>
  );
}
