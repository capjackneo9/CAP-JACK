import type { AzNowPlaying } from "./types";

/** Normalized now-playing shape sent to browsers. Contains only real API data. */
export interface NowPlaying {
  source: "azuracast";
  fetchedAt: string;
  online: boolean;
  stationName: string;
  listenUrl: string | null;
  track: { title: string; artist: string; album: string | null; art: string | null; elapsed: number; duration: number; playlist: string | null } | null;
  next: { title: string; artist: string } | null;
  live: { isLive: boolean; streamerName: string | null; startedAt: string | null };
  /** null when the station owner chose not to display it or the API did not report it. */
  listeners: number | null;
  recent: Array<{ title: string; artist: string; art: string | null; playedAt: string }>;
}

const clean = (s: string | undefined | null) => (s && s.trim() !== "" ? s.trim() : null);

export function normalizeNowPlaying(np: AzNowPlaying, opts: { showListeners: boolean; streamUrlOverride?: string | null }): NowPlaying {
  const defaultMount = np.station.mounts?.find((m) => m.is_default) ?? np.station.mounts?.[0];
  const cur = np.now_playing;
  return {
    source: "azuracast",
    fetchedAt: new Date().toISOString(),
    online: Boolean(np.is_online),
    stationName: np.station.name,
    listenUrl: clean(opts.streamUrlOverride) ?? clean(np.station.listen_url) ?? clean(defaultMount?.url) ?? null,
    track: cur?.song
      ? {
          title: clean(cur.song.title) ?? clean(cur.song.text) ?? "Untitled",
          artist: clean(cur.song.artist) ?? "Unknown artist",
          album: clean(cur.song.album),
          art: clean(cur.song.art ?? undefined),
          elapsed: cur.elapsed ?? 0,
          duration: cur.duration ?? 0,
          playlist: clean(cur.playlist ?? undefined),
        }
      : null,
    next: np.playing_next?.song
      ? { title: clean(np.playing_next.song.title) ?? "Untitled", artist: clean(np.playing_next.song.artist) ?? "" }
      : null,
    live: {
      isLive: Boolean(np.live?.is_live),
      streamerName: np.live?.is_live ? clean(np.live.streamer_name) : null,
      startedAt: np.live?.is_live && np.live.broadcast_start ? new Date(np.live.broadcast_start * 1000).toISOString() : null,
    },
    listeners: opts.showListeners && np.listeners ? np.listeners.current ?? np.listeners.total ?? null : null,
    recent: (np.song_history ?? []).slice(0, 10).map((h) => ({
      title: clean(h.song.title) ?? clean(h.song.text) ?? "Untitled",
      artist: clean(h.song.artist) ?? "",
      art: clean(h.song.art ?? undefined),
      playedAt: new Date(h.played_at * 1000).toISOString(),
    })),
  };
}
