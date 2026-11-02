import { z } from "zod";
import { randomUUID } from "node:crypto";
import { guarded } from "@/lib/api";
import { db } from "@/lib/db";
import { createInviteToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";

export const GET = guarded("guests.invite", async () => {
  const invites = await db.guestInvite.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { booking: { select: { contactName: true, type: true } } } });
  return { invites: invites.map(({ tokenHash: _t, ...rest }) => rest) };
});

const body = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().optional().or(z.literal("")),
  bookingId: z.string().optional(),
  programId: z.string().optional(),
  recordingAllowed: z.boolean().default(false),
  hoursValid: z.number().int().min(1).max(168).default(24),
});

export const POST = guarded("guests.invite", async (req, actor) => {
  const b = body.parse(await req.json());
  const { token, hash } = createInviteToken();
  const invite = await db.guestInvite.create({
    data: {
      guestName: b.guestName, guestEmail: b.guestEmail || null, bookingId: b.bookingId || null, programId: b.programId || null,
      recordingAllowed: b.recordingAllowed, tokenHash: hash, roomName: `ncvr-guest-${randomUUID()}`,
      expiresAt: new Date(Date.now() + b.hoursValid * 3600_000), createdById: actor.id,
    },
  });
  await audit({ userId: actor.id, action: "guests.invite", target: `invite:${invite.id}`, details: { guest: b.guestName } });
  // The raw token is returned exactly once; only its hash is stored.
  return { id: invite.id, link: `${config.appUrl}/guest/${token}`, expiresAt: invite.expiresAt };
});
