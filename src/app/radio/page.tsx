import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { BrandImage } from "@/components/brand/BrandImage";
import { NowPlayingCard } from "@/components/player/NowPlayingCard";
import { getPrograms, scheduledNow } from "@/lib/queries";
import { config } from "@/lib/config";
import { formatRange, toStationTime } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function RadioHome() {
  const [{ programs }, { program: onNow }] = await Promise.all([getPrograms(), scheduledNow()]);
  const now = toStationTime(new Date(), config.timezone);
  const today = programs
    .filter((p) => p.active)
    .flatMap((p) => p.slots.filter((s) => s.dayOfWeek === now.isoDay).map((s) => ({ p, s })))
    .sort((a, b) => a.s.startMinute - b.s.startMinute);

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <div className="kicker">01 // {BRAND.owner} Network</div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-black leading-tight sm:text-6xl">
            THE NIGHT <span className="text-gold-gradient">HAS A SOUND.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--color-muted)]">
            Music. Metaphysics. Culture. Conversations. Broadcasting beyond the ordinary — 24 hours a day.
          </p>
          <p className="mt-2 font-mono text-sm text-[var(--color-signal)]">{BRAND.tagline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/radio/listen">Listen live</Link>
            <Link className="btn btn-ghost" href="/radio/schedule">Schedule</Link>
            <Link className="btn btn-ghost" href="/radio/djs">DJ shows</Link>
            <Link className="btn btn-gold" href="/radio/advertise">Advertise</Link>
          </div>
        </div>
        <NowPlayingCard fallbackArt={<BrandImage src={BRAND.marblePortrait} alt="Caprio Jackson — marble portrait" width={400} height={400} glow="gold" />} />
      </section>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="kicker">Today · Eastern Time</div>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">On the dial</h2>
          </div>
          <Link href="/radio/schedule" className="text-sm text-[var(--color-gold)] hover:underline">Full week →</Link>
        </div>
        <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
          {today.map(({ p, s }) => {
            const live = onNow?.id === p.id && s.startMinute <= now.minute && now.minute < s.endMinute;
            return (
              <Link key={`${p.id}-${s.startMinute}`} href={`/radio/shows/${p.slug}`}
                className={`glass min-w-[220px] snap-start p-4 transition hover:border-[var(--color-gold)] ${live ? "border-[var(--color-signal)]" : ""}`}>
                <div className="font-mono text-xs text-[var(--color-muted)]">{formatRange(s.startMinute, s.endMinute)}</div>
                <div className="mt-1 font-semibold">{p.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">{p.description}</div>
                {live && <div className="mt-2 text-xs font-bold text-[var(--color-signal)]">● ON NOW</div>}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
        <BrandImage src={BRAND.editorialBanner} alt="Caprio Jackson editorial banner" width={1200} height={500} glow="gold" />
        <div>
          <div className="kicker">Featured artist</div>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-black">CAPRIO JACKSON</h2>
          <p className="mt-3 text-[var(--color-muted)]">
            VIBE, ATL Soul, Alt Dimension, Gospel Cinematic and Vibe 19 — the Caprio catalog is the heartbeat of NCVR,
            with room for approved independent and AI-music creators.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/radio/artists" className="btn btn-ghost">Artists</Link>
            <Link href="/radio/submit" className="btn btn-primary">Submit your music</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Weekend Metaphysics", "Three-hour Saturday and Sunday windows — The Metaphysical Matrix and University of the Soul — with music breaks.", "/radio/shows/the-metaphysical-matrix"],
          ["Interviews & Guests", "Book an artist interview or a hosted show. Every booking is reviewed by the station.", "/radio/interviews"],
          ["Sponsor the Night", "Commercial spots, show sponsorships and artist showcases — always disclosed on-air.", "/radio/advertise"],
        ].map(([t, d, h]) => (
          <Link key={t} href={h} className="glass p-5 transition hover:border-[var(--color-gold)]">
            <h3 className="font-[family-name:var(--font-display)] font-bold">{t}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{d}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
