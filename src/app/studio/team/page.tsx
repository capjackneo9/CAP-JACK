import { PageHeader, Badge } from "@/components/ui/Panel";
import { StatusActions } from "@/components/studio/StatusActions";
import { requirePagePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { AREA_LABEL, APPLICATION_LABEL, APPLICATION_STATUSES } from "@/lib/team/areas";
import type { ApplicationStatus } from "@prisma/client";

export const metadata = { title: "Team applications" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission("interns.review");
  const sp = await searchParams;
  const status = (APPLICATION_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ApplicationStatus) : undefined;
  const apps = await db.internApplication.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div className="space-y-4">
      <PageHeader kicker="Internships" title="Team applications" intro="Applications from nitecapviberadio.tech/radio/join." />
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Filter">
        <a href="/studio/team" className={`btn px-3 py-1 ${!status ? "btn-primary" : "btn-ghost"}`}>All</a>
        {APPLICATION_STATUSES.map((s) => <a key={s} href={`?status=${s}`} className={`btn px-3 py-1 ${status === s ? "btn-primary" : "btn-ghost"}`}>{APPLICATION_LABEL[s]}</a>)}
      </nav>
      <div className="space-y-3">
        {apps.map((a) => (
          <article key={a.id} className="glass grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{a.name}</h2>
                <Badge tone={a.status === "ACCEPTED" ? "signal" : a.status === "DECLINED" || a.status === "WITHDRAWN" ? "muted" : "gold"}>{APPLICATION_LABEL[a.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                <a className="hover:underline" href={`mailto:${a.email}`}>{a.email}</a>{a.phone ? ` · ${a.phone}` : ""}{a.location ? ` · ${a.location}` : ""} · {a.createdAt.toLocaleDateString()}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">{a.areas.map((x) => <Badge key={x} tone="royal">{AREA_LABEL[x] ?? x}</Badge>)}</div>
              <p className="mt-2 text-xs">Availability: {a.availability}{a.hoursPerWeek ? ` · ~${a.hoursPerWeek} h/week` : ""}</p>
              <h3 className="kicker mt-3">Experience</h3><p className="whitespace-pre-wrap text-sm">{a.experience}</p>
              <h3 className="kicker mt-3">Why NCVR</h3><p className="whitespace-pre-wrap text-sm">{a.motivation}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {a.portfolioUrl && <a className="text-[var(--color-gold)] hover:underline" href={a.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow">Portfolio ↗</a>}
                {a.resumePath && <a className="text-[var(--color-gold)] hover:underline" href={`/api/studio/team/${a.id}/resume`} target="_blank">Résumé (PDF) ↗</a>}
              </div>
              {a.notes && <p className="mt-2 text-xs text-[var(--color-muted)]">Notes: {a.notes}</p>}
            </div>
            <StatusActions url={`/api/studio/team/${a.id}`} field="status" withNotes
              actions={APPLICATION_STATUSES.filter((s) => s !== a.status && s !== "NEW").map((s) => ({ value: s, label: APPLICATION_LABEL[s], tone: s === "ACCEPTED" ? "btn-primary" : s === "DECLINED" ? "btn-danger" : "btn-ghost" }))} />
          </article>
        ))}
        {apps.length === 0 && <p className="text-sm text-[var(--color-muted)]">No applications yet.</p>}
      </div>
    </div>
  );
}
