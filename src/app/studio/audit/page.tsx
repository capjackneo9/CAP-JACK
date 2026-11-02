import { PageHeader, Badge } from "@/components/ui/Panel";
import { requirePagePermission } from "@/lib/session";
import { db } from "@/lib/db";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requirePagePermission("audit.view");
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { user: { select: { name: true } } } });
  return (
    <div className="space-y-4">
      <PageHeader kicker="Accountability" title="Audit log" />
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">When</th><th>Who</th><th>Action</th><th>Target</th><th className="p-3">Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-white/5 align-top">
                <td className="whitespace-nowrap p-3 text-xs">{l.createdAt.toLocaleString()}</td>
                <td className="py-3 text-xs">{l.user?.name ?? "system"}</td>
                <td className="py-3">{l.action} {l.liveImpact && <Badge tone="live">live</Badge>}</td>
                <td className="py-3 font-mono text-xs">{l.target}</td>
                <td className="max-w-md truncate p-3 font-mono text-[10px] text-[var(--color-muted)]">{l.details ? JSON.stringify(l.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
