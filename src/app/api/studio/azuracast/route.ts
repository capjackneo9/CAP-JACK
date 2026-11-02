import { guarded, HttpError } from "@/lib/api";
import { engine } from "@/lib/azuracast/client";
import { integrations } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Playlists + streamer accounts from AzuraCast (for linking programs/tracks). */
export const GET = guarded("schedule.view", async () => {
  if (!integrations.azuracastAdmin()) throw new HttpError(503, "AzuraCast admin API is not configured");
  const [playlists, streamers] = await Promise.all([engine().playlists(), engine().streamers()]);
  return {
    playlists: playlists.map((p) => ({ id: p.id, name: p.name, type: p.type, enabled: p.is_enabled })),
    streamers: streamers.map((s) => ({ id: s.id, username: s.streamer_username, name: s.display_name, active: s.is_active })),
  };
});
