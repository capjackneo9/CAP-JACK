import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandImage } from "@/components/brand/BrandImage";
import { db } from "@/lib/db";
import { safe } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: h } = await safe(() => db.host.findUnique({ where: { slug }, include: { programs: { where: { active: true } } } }), null);
  if (!h) notFound();
  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <BrandImage src={h.imagePath} alt={h.name} width={600} height={600} glow="gold" />
      <div>
        <div className="kicker">Host profile</div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-black">{h.name}</h1>
        {h.bio && <p className="mt-4 text-lg text-[var(--color-muted)]">{h.bio}</p>}
        <h2 className="kicker mt-8">Shows</h2>
        <ul className="mt-2 space-y-1">
          {h.programs.map((p) => <li key={p.id}><Link className="text-[var(--color-gold)] hover:underline" href={`/radio/shows/${p.slug}`}>{p.title}</Link></li>)}
        </ul>
      </div>
    </article>
  );
}
