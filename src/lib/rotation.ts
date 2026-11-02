/**
 * Rotation goals (Caprio-first policy) and reporting against real play history.
 * Goals are planning targets, not automated restrictions.
 */
export type Bucket = "CAPRIO" | "INDEPENDENT" | "GUEST";

export interface RotationGoals { caprio: number; independent: number; guest: number }

export const DEFAULT_GOALS: RotationGoals = { caprio: 75, independent: 15, guest: 10 };

export function validateGoals(g: RotationGoals): string | null {
  for (const v of [g.caprio, g.independent, g.guest]) {
    if (!Number.isInteger(v) || v < 0 || v > 100) return "Each target must be a whole number from 0 to 100";
  }
  if (g.caprio + g.independent + g.guest !== 100) return "Targets must add up to 100%";
  return null;
}

const CATEGORY_BUCKET: Record<string, Bucket> = {
  CAPRIO_ORIGINALS: "CAPRIO", VIBE_MUSIC: "CAPRIO", ATL_SOUL: "CAPRIO", ALT_DIMENSION: "CAPRIO",
  GOSPEL_CINEMATIC: "CAPRIO", VIBE_19: "CAPRIO", DJ_MIXES: "CAPRIO",
  INDEPENDENT_AI: "INDEPENDENT",
  INTERVIEWS: "GUEST", STATION_IDS: "GUEST", COMMERCIALS: "GUEST", SOUND_EFFECTS: "GUEST",
};

export function bucketForCategory(category: string): Bucket {
  return CATEGORY_BUCKET[category] ?? "GUEST";
}

export interface PlayRecord { mediaId?: number | null; title: string; artist: string; durationSec: number }
export interface LibraryEntry { azuracastMediaId?: number | null; title: string; artistName: string; category: string }

export interface RotationReport {
  totalSec: number;
  unmatchedSec: number;
  plays: number;
  actual: Record<Bucket, number>; // percent of matched airtime
  goals: RotationGoals;
  variance: Record<Bucket, number>; // actual - goal
}

const key = (t: string, a: string) => `${t.trim().toLowerCase()}::${a.trim().toLowerCase()}`;

export function computeRotationReport(history: PlayRecord[], library: LibraryEntry[], goals: RotationGoals): RotationReport {
  const byMedia = new Map<number, LibraryEntry>();
  const byName = new Map<string, LibraryEntry>();
  for (const t of library) {
    if (t.azuracastMediaId != null) byMedia.set(t.azuracastMediaId, t);
    byName.set(key(t.title, t.artistName), t);
  }
  const sec: Record<Bucket, number> = { CAPRIO: 0, INDEPENDENT: 0, GUEST: 0 };
  let unmatched = 0;
  let total = 0;
  for (const p of history) {
    const d = Math.max(0, p.durationSec || 0);
    total += d;
    const entry = (p.mediaId != null && byMedia.get(p.mediaId)) || byName.get(key(p.title, p.artist));
    if (!entry) { unmatched += d; continue; }
    sec[bucketForCategory(entry.category)] += d;
  }
  const matched = total - unmatched;
  const pct = (v: number) => (matched > 0 ? Math.round((v / matched) * 1000) / 10 : 0);
  const actual = { CAPRIO: pct(sec.CAPRIO), INDEPENDENT: pct(sec.INDEPENDENT), GUEST: pct(sec.GUEST) };
  return {
    totalSec: total,
    unmatchedSec: unmatched,
    plays: history.length,
    actual,
    goals,
    variance: {
      CAPRIO: Math.round((actual.CAPRIO - goals.caprio) * 10) / 10,
      INDEPENDENT: Math.round((actual.INDEPENDENT - goals.independent) * 10) / 10,
      GUEST: Math.round((actual.GUEST - goals.guest) * 10) / 10,
    },
  };
}
