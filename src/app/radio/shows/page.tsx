import Link from "next/link";
import { PageHeader, Badge } from "@/components/ui/Panel";
import { getPrograms } from "@/lib/queries";
import { slotSummary } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shows" };

export default async function ShowsPage() {
  const { programs } = await getPrograms();
  const list = programs.filter((p) => p.active);
  return (
    <>
      <PageHeader kicker="Program directory" title="Shows" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <Link key={p.id} href={`/radio/shows/${p.slug}`} className="glass block p-5 transition hover:border-[var(--color-gold)]">
            <div className="flex flex-wrap gap-2">
              {p.format === "LIVE" ? <Badge tone="live">Live</Badge> : p.format === "PRERECORDED" ? <Badge tone="royal">Prerecorded</Badge> : <Badge tone="signal">Rotation</Badge>}
              {p.sponsor && <Badge tone="gold">Sponsored</Badge>}
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold">{p.title}</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{p.description}</p>
            <ul className="mt-3 space-y-0.5 font-mono text-xs text-[var(--color-gold)]">{slotSummary(p.slots).map((s) => <li key={s}>{s}</li>)}</ul>
          </Link>
        ))}
      </div>
    </>
  );
}
