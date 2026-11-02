import { z } from "zod";
import { guarded, HttpError, requireConfirmation } from "@/lib/api";
import { engine } from "@/lib/azuracast/client";
import { normalizeNowPlaying } from "@/lib/azuracast/normalize";
import { integrations } from "@/lib/config";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Studio view of the broadcast engine (includes listener counts for staff). */
export const GET = guarded("studio.access", async () => {
  const out: Record<string, unknown> = { configured: integrations.azuracastPublic(), adminConfigured: integrations.azuracastAdmin(), nowPlaying: null, engine: null, error: null };
  if (!out.configured) return out;
  try {
    out.nowPlaying = normalizeNowPlaying(await engine().nowPlaying(), { showListeners: true, streamUrlOverride: process.env.NEXT_PUBLIC_STREAM_URL || null });
  } catch (e) { out.error = (e as Error).message; }
  if (out.adminConfigured) {
    try { out.engine = await engine().status(); } catch (e) { out.engineError = (e as Error).message; }
  }
  return out;
});

const body = z.object({ action: z.enum(["return-to-autodj", "skip"]), confirm: z.string().optional() });

export const POST = guarded("console.broadcast", async (req, actor) => {
  const b = body.parse(await req.json());
  if (b.action === "return-to-autodj" && !can(actor.role, "broadcast.returnToAutoDJ")) {
    throw new HttpError(403, "Only station managers can force the station back to AutoDJ. Stop your own transmission to hand back automatically.");
  }
  if (!integrations.azuracastAdmin()) throw new HttpError(503, "AzuraCast admin API is not configured (AZURACAST_API_KEY).");
  if (b.action === "return-to-autodj") {
    requireConfirmation(b, "RETURN TO AUTODJ");
    await engine().disconnectStreamer();
    await audit({ userId: actor.id, action: "broadcast.returnToAutoDJ", liveImpact: true });
    return { ok: true, message: "Live streamer disconnected — AzuraCast AutoDJ resumes the scheduled programming." };
  }
  requireConfirmation(b, "SKIP");
  await engine().skipSong();
  await audit({ userId: actor.id, action: "broadcast.skip", liveImpact: true });
  return { ok: true, message: "Skip requested." };
});
