import Link from "next/link";
import { DAY_SHORT, formatRange } from "@/lib/schedule";
import type { PublicProgram } from "@/lib/queries";

/** Read-only weekly schedule (Eastern Time). */
export function WeekGrid({ programs, nowDay, nowMinute }: { programs: PublicProgram[]; nowDay: number; nowMinute: number }) {
  const days = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const items = programs
          .filter((p) => p.active)
          .flatMap((p) => p.slots.filter((s) => s.dayOfWeek === d).map((s) => ({ p, s })))
          .sort((a, b) => a.s.startMinute - b.s.startMinute);
        return (
          <section key={d} aria-label={DAY_SHORT[d]} className={`glass p-3 ${d === nowDay ? "ring-1 ring-[var(--color-gold)]/60" : ""}`}>
            <h3 className="mb-2 font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">{DAY_SHORT[d]}{d === nowDay && <span className="ml-2 text-[10px] text-[var(--color-gold)]">TODAY</span>}</h3>
            <ul className="space-y-2">
              {items.map(({ p, s }) => {
                const now = d === nowDay && s.startMinute <= nowMinute && nowMinute < s.endMinute;
                return (
                  <li key={`${p.id}-${s.startMinute}`}>
                    <Link href={`/radio/shows/${p.slug}`}
                      className={`block rounded-lg border p-2 text-xs transition hover:border-[var(--color-gold)] ${now ? "border-[var(--color-signal)] bg-[var(--color-signal)]/10" : "border-white/10 bg-black/20"}`}>
                      <div className="font-mono text-[10px] text-[var(--color-muted)]">{formatRange(s.startMinute, s.endMinute)}</div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="mt-0.5 flex gap-1">
                        {p.format === "LIVE" && <span className="text-[10px] text-[var(--color-live)]">LIVE</span>}
                        {now && <span className="text-[10px] text-[var(--color-signal)]">ON NOW</span>}
                        {p.sponsor && <span className="text-[10px] text-[var(--color-gold)]">Sponsored</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
