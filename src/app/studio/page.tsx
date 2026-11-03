import Link from "next/link";
import { Panel, Badge, Notice } from "@/components/ui/Panel";
import { BroadcastStatusCard } from "@/components/studio/BroadcastStatusCard";
import { requirePagePermission } from "@/lib/session";
import { integrationStatus } from "@/lib/config";
import { db } from "@/lib/db";
import { getPrograms, scheduledNow, safe } from "@/lib/queries";
import { analyzeSchedule } from "@/lib/schedule";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  await requirePagePermission("studio.access");
  const status = integrationStatus();
  const [{ programs }, onNow, counts] = await Promise.all([
    getPrograms(),
    scheduledNow(),
    safe(async () => ({
      submissions: await db.submission.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      tracks: await db.track.count({ where: { status: "PENDING_REVIEW" } }),
      bookings: await db.booking.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } } }),
      applications: await db.internApplication.count({ where: { status: "NEW" } }),
    }), { submissions: 0, tracks: 0, bookings: 0, applications: 0 }),
  ]);
  const report = analyzeSchedule(programs, programs.flatMap((p) => p.slots.map((s) => ({ ...s, programId: p.id }))));
  const rows: Array<[string, boolean, string]> = [
    ["Database", status.database, "DATABASE_URL"],
    ["Auth secret", status.authSecret, "AUTH_SECRET"],
    ["AzuraCast (public Now Playing)", status.azuracastPublic, "AZURACAST_BASE_URL + AZURACAST_STATION_ID"],
    ["AzuraCast admin API", status.azuracastAdmin, "AZURACAST_API_KEY"],
    ["Studio webcast transmitter", status.webcast, "NEXT_PUBLIC_WEBCAST_URL"],
    ["Guest rooms (LiveKit)", status.livekit, "LIVEKIT_URL / API key / secret"],
    ["Payments (Stripe)", status.stripe, "STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET"],
    ["NCVR TV live video (MediaMTX)", status.liveVideo, "MEDIAMTX_API_URL"],
  ];
  return (
    <div className="space-y-4">
      {sp.denied && <Notice tone="error">Your role does not include “{sp.denied}”.</Notice>}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <BroadcastStatusCard scheduled={onNow.program ? { title: onNow.program.title, source: onNow.resolved?.source ?? "schedule" } : null} />
        <Panel kicker="Queues" title="Needs attention">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><Link className="hover:underline" href="/studio/submissions">Submissions awaiting review</Link><Badge tone="gold">{counts.data.submissions}</Badge></li>
            <li className="flex justify-between"><Link className="hover:underline" href="/studio/library">Tracks pending approval</Link><Badge tone="gold">{counts.data.tracks}</Badge></li>
            <li className="flex justify-between"><Link className="hover:underline" href="/studio/bookings">Booking requests</Link><Badge tone="gold">{counts.data.bookings}</Badge></li>
            <li className="flex justify-between"><Link className="hover:underline" href="/studio/team">New team applications</Link><Badge tone="gold">{counts.data.applications}</Badge></li>
          </ul>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel kicker="Programming" title="Schedule health">
          <p className="text-sm">Coverage: <strong>{(report.coveredMinutes / 60).toFixed(1)} / 168 hours</strong></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.ok ? <Badge tone="signal">Valid week</Badge> : <Badge tone="danger">{report.gaps.length} gaps · {report.conflicts.length} conflicts</Badge>}
            {report.fallbackAvailable ? <Badge tone="royal">Fallback: default Caprio rotation</Badge> : <Badge tone="danger">No fallback program</Badge>}
          </div>
          <Link className="btn btn-ghost mt-4 text-sm" href="/studio/schedule">Open scheduler</Link>
        </Panel>
        <Panel kicker="Integrations" title="Connections">
          <ul className="space-y-1.5 text-sm">
            {rows.map(([name, ok, envName]) => (
              <li key={name} className="flex items-center justify-between gap-3">
                <span>{name}</span>
                {ok ? <Badge tone="signal">Configured</Badge> : <span className="text-right text-xs text-[var(--color-muted)]">Not configured · <code>{envName}</code></span>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
