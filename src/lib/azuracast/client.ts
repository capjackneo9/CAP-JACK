import "server-only";
import { config, integrations } from "../config";
import type { AzHistoryItem, AzMedia, AzNowPlaying, AzPlaylist, AzScheduleItem, AzStationStatus, AzStreamer } from "./types";

export class BroadcastEngineError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
export class NotConfiguredError extends BroadcastEngineError {
  constructor(what: string) { super(`AzuraCast is not configured (${what}). Set the AZURACAST_* environment variables.`); }
}

/**
 * Broadcast-engine adapter. The UI talks only to this interface, so another
 * engine (or a second station) can be added without rewriting screens.
 */
export interface BroadcastEngine {
  nowPlaying(): Promise<AzNowPlaying>;
  status(): Promise<AzStationStatus>;
  history(start: Date, end: Date): Promise<AzHistoryItem[]>;
  playlists(): Promise<AzPlaylist[]>;
  setPlaylistSchedule(playlistId: number, items: AzScheduleItem[]): Promise<void>;
  streamers(): Promise<AzStreamer[]>;
  uploadMedia(path: string, data: Buffer): Promise<AzMedia>;
  assignMediaPlaylists(mediaId: number, playlistIds: number[]): Promise<void>;
  disconnectStreamer(): Promise<void>;
  skipSong(): Promise<void>;
}

const TIMEOUT_MS = 10_000;

async function request<T>(path: string, init: RequestInit & { admin?: boolean } = {}): Promise<T> {
  const { baseUrl, apiKey } = config.azuracast;
  if (!baseUrl) throw new NotConfiguredError("AZURACAST_BASE_URL");
  if (init.admin && !apiKey) throw new NotConfiguredError("AZURACAST_API_KEY");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.admin && apiKey) headers.set("X-API-Key", apiKey);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new BroadcastEngineError(`Could not reach AzuraCast: ${(e as Error).message}`);
  }
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = j?.message ?? j?.formatted_message ?? ""; } catch { /* ignore */ }
    throw new BroadcastEngineError(`AzuraCast ${res.status} on ${path}${detail ? `: ${detail}` : ""}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function station(): string {
  const id = config.azuracast.stationId;
  if (!id) throw new NotConfiguredError("AZURACAST_STATION_ID");
  return encodeURIComponent(id);
}

export const azuracast: BroadcastEngine = {
  nowPlaying: () => request<AzNowPlaying>(`/api/nowplaying/${station()}`),
  status: () => request<AzStationStatus>(`/api/station/${station()}/status`, { admin: true }),
  history: (start, end) =>
    request<AzHistoryItem[]>(
      `/api/station/${station()}/history?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
      { admin: true },
    ),
  playlists: () => request<AzPlaylist[]>(`/api/station/${station()}/playlists`, { admin: true }),
  async setPlaylistSchedule(playlistId, items) {
    await request(`/api/station/${station()}/playlist/${playlistId}`, {
      method: "PUT", admin: true, body: JSON.stringify({ schedule_items: items }),
    });
  },
  streamers: () => request<AzStreamer[]>(`/api/station/${station()}/streamers`, { admin: true }),
  uploadMedia: (path, data) =>
    request<AzMedia>(`/api/station/${station()}/files`, {
      method: "POST", admin: true, body: JSON.stringify({ path, file: data.toString("base64") }),
    }),
  async assignMediaPlaylists(mediaId, playlistIds) {
    await request(`/api/station/${station()}/file/${mediaId}`, {
      method: "PUT", admin: true, body: JSON.stringify({ playlists: playlistIds.map((id) => ({ id })) }),
    });
  },
  async disconnectStreamer() {
    await request(`/api/station/${station()}/backend/disconnect`, { method: "POST", admin: true });
  },
  async skipSong() {
    await request(`/api/station/${station()}/backend/skip`, { method: "POST", admin: true });
  },
};

export function engine(): BroadcastEngine {
  return azuracast;
}

export { integrations };
