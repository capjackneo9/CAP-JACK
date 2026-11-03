"use client";
import Link from "next/link";
import { useBroadcast } from "./useBroadcast";
import { Badge } from "../ui/Panel";

export function BroadcastStatusCard({ scheduled }: { scheduled: { title: string; source: string } | null }) {
  const { info, fetchError } = useBroadcast(8000);
  const np = info?.nowPlaying;
  return (
    <section className="glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="kicker">Program output</div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">Broadcast status</h2>
        </div>
        <div className={`rounded-lg border px-4 py-2 font-[family-name:var(--font-display)] text-sm font-black tracking-[0.3em] ${np?.live.isLive ? "onair-lit border-[var(--color-live)] bg-[var(--color-live)] text-white" : "border-white/15 text-[var(--color-muted)]"}`}>
          {np?.live.isLive ? "LIVE DJ" : "AUTODJ"}
        </div>
      </div>
      {!info?.configured && <p className="mt-4 text-sm text-[var(--color-muted)]">AzuraCast is not connected. Set <code>AZURACAST_BASE_URL</code> and <code>AZURACAST_STATION_ID</code> to see real broadcast data here.</p>}
      {fetchError && <p className="mt-3 text-sm text-red-300">{fetchError}</p>}
      {info?.error && <p className="mt-3 text-sm text-red-300">AzuraCast: {info.error}</p>}
      {np && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[96px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={np.track?.art || "/brand/ncvr-emblem-192.png"} alt="" className="h-24 w-24 rounded-xl object-cover" />
          <div className="space-y-1 text-sm">
            <div className="text-lg font-semibold">{np.track ? `${np.track.title} — ${np.track.artist}` : "No track reported"}</div>
            {np.track?.playlist && <div className="text-[var(--color-muted)]">Playlist: {np.track.playlist}</div>}
            {np.live.isLive && <div className="text-[var(--color-live)]">Live: {np.live.streamerName}</div>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge tone={np.online ? "signal" : "danger"}>{np.online ? "Stream online" : "Stream offline"}</Badge>
              {typeof np.listeners === "number" && <Badge tone="royal">{np.listeners} listeners</Badge>}
              {info?.engine && <Badge tone={info.engine.backend_running ? "signal" : "danger"}>Liquidsoap {info.engine.backend_running ? "running" : "stopped"}</Badge>}
              {info?.engine && <Badge tone={info.engine.frontend_running ? "signal" : "danger"}>Icecast {info.engine.frontend_running ? "running" : "stopped"}</Badge>}
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-sm">
        <span className="text-[var(--color-muted)]">Scheduled now (NCVR metadata):</span>
        <strong>{scheduled?.title ?? "—"}</strong>
        {scheduled?.source === "fallback" && <Badge tone="gold">Fallback rotation</Badge>}
        {scheduled?.source === "override" && <Badge tone="live">Override</Badge>}
        <Link href="/studio/console" className="btn btn-live ml-auto px-4 py-1.5 text-sm">Open console</Link>
      </div>
    </section>
  );
}
