import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { livekitToken } from "@/lib/livekit";

/** Host joins the guest room: subscribes to the guest and publishes talkback mic. */
export const POST = guarded<{ id: string }>("guests.invite", async (_req, actor, { id }) => {
  const inv = await db.guestInvite.findUnique({ where: { id } });
  if (!inv || inv.status === "REVOKED" || inv.status === "ENDED") throw new HttpError(404, "Invite not active");
  const t = await livekitToken({ room: inv.roomName, identity: `host-${actor.id}`, name: `${actor.name} (NCVR host)`, canPublish: true });
  return { ...t, guestIdentity: `guest-${inv.id}`, consent: Boolean(inv.guestConsentedAt) && inv.recordingAllowed };
});
