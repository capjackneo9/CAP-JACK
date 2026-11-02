import "server-only";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { config, integrations } from "./config";

export function livekitConfigured() { return integrations.livekit(); }

export async function livekitToken(opts: { room: string; identity: string; name: string; canPublish: boolean; ttlSec?: number; metadata?: string }) {
  if (!integrations.livekit()) throw new Error("LiveKit is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)");
  const at = new AccessToken(config.livekit.apiKey!, config.livekit.apiSecret!, { identity: opts.identity, name: opts.name, ttl: opts.ttlSec ?? 4 * 3600, metadata: opts.metadata });
  at.addGrant({ room: opts.room, roomJoin: true, canPublish: opts.canPublish, canPublishSources: opts.canPublish ? ["microphone" as never] : [], canSubscribe: true, canPublishData: false });
  return { token: await at.toJwt(), url: config.livekit.url! };
}

function roomService() {
  const httpUrl = config.livekit.url!.replace(/^ws/, "http");
  return new RoomServiceClient(httpUrl, config.livekit.apiKey!, config.livekit.apiSecret!);
}

/** Host-controlled guest mute, enforced by the media server (not just locally). */
export async function setGuestMuted(room: string, identity: string, muted: boolean) {
  const svc = roomService();
  const p = await svc.getParticipant(room, identity);
  for (const t of p.tracks) await svc.mutePublishedTrack(room, identity, t.sid, muted);
}

export async function removeGuest(room: string, identity: string) {
  await roomService().removeParticipant(room, identity).catch(() => null);
}
