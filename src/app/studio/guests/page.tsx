import { PageHeader, Notice } from "@/components/ui/Panel";
import { GuestInvites } from "@/components/studio/GuestInvites";
import { requirePagePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { integrations } from "@/lib/config";

export const metadata = { title: "Guest rooms" };

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ booking?: string; name?: string }> }) {
  await requirePagePermission("guests.invite");
  const sp = await searchParams;
  const programs = await db.program.findMany({ where: { active: true }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader kicker="Remote guests" title="Guest rooms" intro="Guests join a private WebRTC waiting room — never the stream server. Their audio stays off the program until you press ON AIR in the console." />
      {!integrations.livekit() && <Notice tone="warn">LiveKit is not configured. Invitations can be created, but guests cannot connect until LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set.</Notice>}
      <GuestInvites programs={programs} preset={{ bookingId: sp.booking, name: sp.name }} />
    </div>
  );
}
