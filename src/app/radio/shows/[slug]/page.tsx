import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandImage } from "@/components/brand/BrandImage";
import { Badge, Notice } from "@/components/ui/Panel";
import { getPrograms } from "@/lib/queries";
import { BRAND } from "@/lib/brand";
import { slotSummary } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { programs } = await getPrograms();
  const p = programs.find((x) => x.slug === slug && x.active);
  if (!p) notFound();
  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <BrandImage src={p.imagePath ?? BRAND.marblePortrait} alt={`${p.title} show artwork`} width={600} height={600} glow="gold" />
      <div>
        <div className="kicker">NCVR program</div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-black">{p.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.format === "LIVE" ? <Badge tone="live">Live show</Badge> : p.format === "PRERECORDED" ? <Badge>Prerecorded</Badge> : <Badge tone="signal">Music rotation</Badge>}
        </div>
        <p className="mt-4 text-lg text-[var(--color-muted)]">{p.description}</p>
        <h2 className="mt-6 kicker">When</h2>
        <ul className="mt-1 font-mono text-sm">{slotSummary(p.slots).map((s) => <li key={s}>{s}</li>)}</ul>
        {p.host && <p className="mt-4">Hosted by <Link className="text-[var(--color-gold)] hover:underline" href={`/radio/djs/${p.host.slug}`}>{p.host.name}</Link></p>}
        {p.featuredGuest && <p className="mt-2">Featured guest: <strong>{p.featuredGuest}</strong></p>}
        {p.sponsor && (
          <div className="mt-6">
            <Notice tone="warn">
              <strong>Sponsored:</strong> {p.title} is presented by {p.sponsor.website ? <a className="underline" href={p.sponsor.website} rel="sponsored noopener">{p.sponsor.name}</a> : p.sponsor.name}. {p.sponsor.disclosure}.
            </Notice>
          </div>
        )}
      </div>
    </article>
  );
}
