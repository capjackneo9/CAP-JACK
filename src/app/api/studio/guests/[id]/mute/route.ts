import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setGuestMuted } from "@/lib/livekit";
import { audit } from "@/lib/audit";

const body = z.object({ muted: z.boolean() });

export const POST = guarded<{ id: string }>("guests.invite", async (req, actor, { id }) => {
  const { muted } = body.parse(await req.json());
  const inv = await db.guestInvite.findUnique({ where: { id } });
  if (!inv) throw new HttpError(404, "Invite not found");
  await setGuestMuted(inv.roomName, `guest-${inv.id}`, muted);
  await audit({ userId: actor.id, action: muted ? "guests.mute" : "guests.unmute", target: `invite:${id}` });
  return { ok: true };
});
