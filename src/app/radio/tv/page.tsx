import { existsSync } from "node:fs";
import path from "node:path";
import { TvPlayer } from "@/components/tv/TvPlayer";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { DAY_SHORT, formatMinute } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export const metadata = { title: "NCVR TV", description: "Music videos around the clock and live video from the NCVR studio." };

export default async function TvPage() {
  const blocks = await db.tvBlock.findMany({ where: { active: true }, orderBy: [{ startMinute: "asc" }] }).catch(() => []);
  const hasTvLogo = existsSync(path.join(process.cwd(), "public", BRAND.tvLogo));
  return (
    <>
      <header className="mb-8">
        {hasTvLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={BRAND.tvLogo} alt="NCVR TV" className="w-full max-w-xl drop-shadow-[0_0_24px_rgba(140,60,255,0.35)]" />
        ) : (
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-black tracking-wide sm:text-5xl">NCVR <span className="text-gold-gradient">TV</span></h1>
        )}
        <p className="mt-3 max-w-3xl text-[var(--color-muted)]">
          Music videos around the clock. When a host goes live on camera, NCVR TV switches to the live feed automatically.
        </p>
      </header>
      <TvPlayer bugSrc={hasTvLogo ? BRAND.tvLogo : "/brand/ncvr-emblem.webp"} />
      {blocks.length > 0 && (
        <section className="mt-6 glass p-5">
          <div className="kicker">NCVR TV schedule · Eastern Time</div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {blocks.map((b) => (
              <li key={b.id} className="rounded-xl border border-[var(--color-gold)]/30 p-3">
                <div className="font-[family-name:var(--font-display)] font-bold">{b.title}</div>
                <div className="font-mono text-xs text-[var(--color-muted)]">{b.days.map((d) => DAY_SHORT[d]).join(", ")} · {formatMinute(b.startMinute)} – {b.endMinute === 1440 ? "12 AM" : formatMinute(b.endMinute)}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-muted)]">All other times: non-stop music videos.</p>
        </section>
      )}
    </>
  );
}
