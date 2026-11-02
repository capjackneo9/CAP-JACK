import "server-only";
import { db, getStation } from "./db";
import { DEFAULT_PROGRAMS, resolveProgram } from "./schedule";
import { config } from "./config";

export interface PublicProgram {
  id: string; slug: string; title: string; description: string | null; format: string; imagePath: string | null;
  featuredGuest: string | null; active: boolean; isFallback: boolean; exclusive: boolean; bucket: string;
  host: { slug: string; name: string } | null;
  sponsor: { name: string; disclosure: string; website: string | null } | null;
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
}

export interface ProgramsResult { programs: PublicProgram[]; source: "database" | "defaults"; error?: string }

/** Programs from the DB; if the DB is unreachable, the seeded launch schedule (clearly labelled). */
export async function getPrograms(): Promise<ProgramsResult> {
  try {
    const station = await getStation();
    if (!station) throw new Error("Station not seeded");
    const rows = await db.program.findMany({
      where: { stationId: station.id },
      include: { host: { select: { slug: true, name: true } }, sponsor: { select: { name: true, disclosure: true, website: true, active: true } }, slots: true },
      orderBy: { title: "asc" },
    });
    return {
      source: "database",
      programs: rows.map((p) => ({
        ...p,
        sponsor: p.sponsor?.active ? { name: p.sponsor.name, disclosure: p.sponsor.disclosure, website: p.sponsor.website } : null,
        slots: p.slots.map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute })),
      })),
    };
  } catch (e) {
    return {
      source: "defaults",
      error: (e as Error).message,
      programs: DEFAULT_PROGRAMS.map((p) => ({
        id: p.slug, slug: p.slug, title: p.title, description: p.description, format: p.format, imagePath: null, featuredGuest: null,
        active: true, isFallback: Boolean(p.isFallback), exclusive: true, bucket: p.bucket,
        host: { slug: "caprio-jackson", name: "Caprio Jackson" }, sponsor: null,
        slots: p.slots.flatMap(([days, s, e]) => days.map((d) => ({ dayOfWeek: d, startMinute: s * 60, endMinute: e * 60 }))),
      })),
    };
  }
}

export async function getOverrides() {
  try {
    return await db.scheduleOverride.findMany({ where: { endsAt: { gte: new Date() } } });
  } catch {
    return [];
  }
}

/** Program the schedule says is on air now (metadata only — the stream may differ, e.g. a live DJ). */
export async function scheduledNow(at = new Date()) {
  const { programs } = await getPrograms();
  const overrides = await getOverrides();
  const r = resolveProgram(at, config.timezone, programs, programs.flatMap((p) => p.slots.map((s) => ({ ...s, programId: p.id }))), overrides);
  const program = r ? programs.find((p) => p.id === r.programId) ?? null : null;
  return { resolved: r, program };
}

export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<{ data: T; error?: string }> {
  try { return { data: await fn() }; } catch (e) { return { data: fallback, error: (e as Error).message }; }
}
