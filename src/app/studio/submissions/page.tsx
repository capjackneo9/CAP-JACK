import { PageHeader, Badge } from "@/components/ui/Panel";
import { StatusActions } from "@/components/studio/StatusActions";
import { requirePagePermission } from "@/lib/session";
import { permissionsFor } from "@/lib/rbac";
import { db } from "@/lib/db";
import { allowedTransitions, STATUS_LABELS, type SubmissionStatus } from "@/lib/submissions/workflow";

export const metadata = { title: "Submissions" };

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePagePermission("submissions.review");
  const sp = await searchParams;
  const perms = permissionsFor(actor.role);
  const where = sp.status && sp.status in STATUS_LABELS ? { status: sp.status as SubmissionStatus } : {};
  const subs = await db.submission.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { reviewer: { select: { name: true } } } });
  return (
    <div className="space-y-4">
      <PageHeader kicker="Editorial review" title="Music submissions" intro="Payment status is shown for reference only — it never affects editorial decisions." />
      <nav className="flex flex-wrap gap-2 text-xs" aria-label="Filter">
        <a href="/studio/submissions" className="btn btn-ghost px-3 py-1">All</a>
        {Object.entries(STATUS_LABELS).map(([k, l]) => <a key={k} href={`?status=${k}`} className={`btn px-3 py-1 ${sp.status === k ? "btn-primary" : "btn-ghost"}`}>{l}</a>)}
      </nav>
      <div className="space-y-3">
        {subs.map((s) => {
          const next = allowedTransitions(s.status).filter((t) => t.permission === "public" ? false : perms.includes(t.permission));
          return (
            <article key={s.id} className="glass grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">{s.songTitle}</h2><span className="text-[var(--color-muted)]">by {s.artistName}</span>
                  <Badge tone={s.status === "APPROVED" || s.status === "SCHEDULED" ? "signal" : s.status === "REJECTED" ? "danger" : "gold"}>{STATUS_LABELS[s.status]}</Badge>
                  {s.paymentStatus !== "NONE" && <Badge tone="muted">Payment: {s.paymentStatus.toLowerCase()}</Badge>}
                  {s.aiGenerated && <Badge tone="royal">AI-assisted{s.aiToolsUsed ? `: ${s.aiToolsUsed}` : ""}</Badge>}
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{s.genre} · {s.email} · {s.createdAt.toLocaleString()}{s.promoPackage ? ` · package: ${s.promoPackage}` : ""}</p>
                <p className="mt-2 text-sm">{s.bio}</p>
                <audio controls preload="none" src={`/api/studio/submissions/${s.id}/audio`} className="mt-3 w-full" />
                <p className="mt-2 text-xs text-[var(--color-muted)]">Rights confirmed: {s.commercialRightsConfirmed ? "yes" : "NO"} · Broadcast permission: {s.broadcastPermissionGranted ? "yes" : "NO"}</p>
                {s.reviewNotes && <p className="mt-1 text-xs">Notes: {s.reviewNotes}{s.reviewer ? ` — ${s.reviewer.name}` : ""}</p>}
              </div>
              <StatusActions url={`/api/studio/submissions/${s.id}`} withNotes
                actions={next.map((t) => ({ value: t.to, label: `→ ${STATUS_LABELS[t.to]}`, tone: t.to === "APPROVED" ? "btn-primary" : t.to === "REJECTED" ? "btn-danger" : "btn-ghost" }))} />
            </article>
          );
        })}
        {subs.length === 0 && <p className="text-sm text-[var(--color-muted)]">No submissions.</p>}
      </div>
    </div>
  );
}
