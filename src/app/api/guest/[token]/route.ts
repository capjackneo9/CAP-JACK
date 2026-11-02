import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { livekitConfigured, livekitToken } from "@/lib/livekit";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const inv = await db.guestInvite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv || inv.status === "REVOKED" || inv.status === "ENDED" || inv.expiresAt < new Date()) return null;
  return inv;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`guest:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const inv = await findInvite((await params).token);
  if (!inv) return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 404 });
  const program = inv.programId ? await db.program.findUnique({ where: { id: inv.programId }, select: { title: true } }) : null;
  return NextResponse.json({
    guestName: inv.guestName, show: program?.title ?? null, expiresAt: inv.expiresAt, recordingAllowed: inv.recordingAllowed,
    status: inv.status, mediaConfigured: livekitConfigured(),
  });
}

const body = z.object({ recordingConsent: z.boolean() });

/** Guest enters the waiting room: records consent, returns a media-room token (never stream credentials). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!rateLimit(`guest:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: "Slow down" }, { status: 429 });
  const inv = await findInvite((await params).token);
  if (!inv) return NextResponse.json({ error: "This invitation is invalid or has expired." }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!livekitConfigured()) return NextResponse.json({ error: "The guest studio is not configured yet. Please contact your host." }, { status: 503 });
  await db.guestInvite.update({
    where: { id: inv.id },
    data: { status: inv.status === "ON_AIR" ? "ON_AIR" : "WAITING", guestConsentedAt: parsed.data.recordingConsent ? new Date() : null },
  });
  const t = await livekitToken({ room: inv.roomName, identity: `guest-${inv.id}`, name: inv.guestName, canPublish: true, ttlSec: 3 * 3600 });
  return NextResponse.json(t);
}
