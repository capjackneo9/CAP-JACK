import { ScheduleEditor } from "@/components/studio/schedule/ScheduleEditor";
import { OverridesPanel } from "@/components/studio/schedule/OverridesPanel";
import { PageHeader, Notice } from "@/components/ui/Panel";
import { requirePagePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { loadSchedule } from "@/lib/schedule-data";
import { engine } from "@/lib/azuracast/client";
import { integrations } from "@/lib/config";

export const metadata = { title: "Scheduler" };

export default async function SchedulePage() {
  const actor = await requirePagePermission("schedule.view");
  const data = await loadSchedule();
  let playlists: Array<{ id: number; name: string }> | null = null;
  let engineErr: string | null = null;
  if (integrations.azuracastAdmin()) {
    try { playlists = (await engine().playlists()).map((p) => ({ id: p.id, name: p.name })); } catch (e) { engineErr = (e as Error).message; }
  }
  const programs = data.programs.map(({ slots: _s, ...p }) => ({ ...p, syncedAt: p.syncedAt?.toISOString() ?? null }));
  return (
    <div className="space-y-4">
      <PageHeader kicker="24 / 7 programming" title="Program scheduler"
        intro={<>Radio programming below. Video blocks such as <strong>Saturday Morning Cartoons</strong> live in the <a className="text-[var(--color-gold)] hover:underline" href="/studio/videos">NCVR TV schedule →</a></>} />
      {engineErr && <Notice tone="error">AzuraCast: {engineErr}</Notice>}
      <ScheduleEditor initialPrograms={programs} initialSlots={data.programs.flatMap((p) => p.slots)} canEdit={can(actor.role, "schedule.edit")}
        canPublish={can(actor.role, "schedule.publish")} hosts={data.hosts} sponsors={data.sponsors.filter((s) => s.active)} playlists={playlists} />
      <OverridesPanel initial={data.overrides.map((o) => ({ ...o, startsAt: o.startsAt.toISOString(), endsAt: o.endsAt.toISOString() }))}
        programs={data.programs.map((p) => ({ id: p.id, title: p.title }))} canEdit={can(actor.role, "schedule.edit")} />
    </div>
  );
}
