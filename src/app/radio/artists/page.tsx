import { PageHeader, Notice, Badge } from "@/components/ui/Panel";
import { BrandImage } from "@/components/brand/BrandImage";
import { db } from "@/lib/db";
import { safe } from "@/lib/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artists" };

export default async function ArtistsPage() {
  const { data: artists, error } = await safe(() => db.artist.findMany({ orderBy: [{ isCaprio: "desc" }, { featured: "desc" }, { name: "asc" }] }), []);
  const [lead, ...rest] = artists;
  return (
    <>
      <PageHeader kicker="Featured music" title="Artists" intro="Caprio Jackson's catalog leads the station, joined by approved independent and AI-music creators." />
      {error && <Notice tone="warn">Artist directory unavailable: the station database is not connected.</Notice>}
      {lead && (
        <section className="relative overflow-hidden rounded-3xl">
          <BrandImage src={lead.imagePath} alt={`${lead.name} editorial banner`} width={1400} height={560} glow="gold" fallbackSrc="/brand/ncvr-wordmark.webp" />
          <div className="mt-4 max-w-2xl">
            {lead.isCaprio && <Badge tone="gold">Station founder</Badge>}
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-black">{lead.name}</h2>
            <p className="mt-2 text-[var(--color-muted)]">{lead.bio}</p>
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((a) => (
            <div key={a.id} className="glass p-4">
              <BrandImage src={a.imagePath} alt={a.name} width={400} height={400} />
              <h3 className="mt-3 font-bold">{a.name}</h3>
              {a.bio && <p className="mt-1 line-clamp-3 text-xs text-[var(--color-muted)]">{a.bio}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-10 text-sm text-[var(--color-muted)]">Are you an independent or AI-music creator? <Link className="text-[var(--color-gold)] hover:underline" href="/radio/submit">Submit your music for review.</Link></p>
    </>
  );
}
