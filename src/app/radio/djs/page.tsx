import Link from "next/link";
import { PageHeader, Notice } from "@/components/ui/Panel";
import { BrandImage } from "@/components/brand/BrandImage";
import { db } from "@/lib/db";
import { safe } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "DJs & hosts" };

export default async function DjsPage() {
  const { data: hosts, error } = await safe(() => db.host.findMany({ orderBy: [{ featured: "desc" }, { name: "asc" }], include: { programs: { where: { active: true }, select: { title: true } } } }), []);
  return (
    <>
      <PageHeader kicker="On the mic" title="DJs & hosts" />
      {error && <Notice tone="warn">Host directory unavailable: the station database is not connected.</Notice>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {hosts.map((h) => (
          <Link key={h.id} href={`/radio/djs/${h.slug}`} className="glass block p-4 transition hover:border-[var(--color-gold)]">
            <BrandImage src={h.imagePath} alt={h.name} width={400} height={400} />
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-lg font-bold">{h.name}</h2>
            <p className="text-xs text-[var(--color-muted)]">{h.programs.map((p) => p.title).join(" · ")}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
