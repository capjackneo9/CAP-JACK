import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { livekitConfigured, removeGuest } from "@/lib/livekit";

const body = z.object({ action: z.enum(["revoke", "end", "on-air", "off-air"]) });

export const PATCH = guarded<{ id: string }>("guests.invite", async (req, actor, { id }) => {
  const { action } = body.parse(await req.json());
  const inv = await db.guestInvite.findUnique({ where: { id } });
  if (!inv) throw new HttpError(404, "Invite not found");
  const status = action === "revoke" ? "REVOKED" : action === "end" ? "ENDED" : action === "on-air" ? "ON_AIR" : "WAITING";
  if ((action === "revoke" || action === "end") && livekitConfigured()) await removeGuest(inv.roomName, `guest-${inv.id}`);
  await db.guestInvite.update({ where: { id }, data: { status } });
  await audit({ userId: actor.id, action: `guests.${action}`, target: `invite:${id}`, liveImpact: action === "on-air" || action === "off-air" });
  return { ok: true, status };
});
