/**
 * Linear "TV channel" clock: the approved music-video playlist loops forever
 * from a fixed epoch, so every viewer sees the same video at the same moment —
 * like a broadcast channel, without a video streaming server.
 */
export interface RotationVideo { id: string; durationSec: number }

export const TV_EPOCH = Date.UTC(2026, 0, 1); // fixed reference point

export interface RotationPosition {
  index: number;
  videoId: string;
  offsetSec: number;     // how far into the current video we are
  remainingSec: number;
  cycleSec: number;
}

export function rotationPosition(videos: RotationVideo[], now: number, epoch = TV_EPOCH): RotationPosition | null {
  const list = videos.filter((v) => v.durationSec > 0);
  const cycle = list.reduce((s, v) => s + v.durationSec, 0);
  if (!list.length || cycle <= 0) return null;
  let t = (((now - epoch) / 1000) % cycle + cycle) % cycle;
  for (let i = 0; i < list.length; i++) {
    if (t < list[i].durationSec) {
      return { index: i, videoId: list[i].id, offsetSec: t, remainingSec: list[i].durationSec - t, cycleSec: cycle };
    }
    t -= list[i].durationSec;
  }
  // Floating-point edge: wrap to the start.
  return { index: 0, videoId: list[0].id, offsetSec: 0, remainingSec: list[0].durationSec, cycleSec: cycle };
}

/** The next `count` videos after the current one (wrapping). */
export function upNext<T extends RotationVideo>(videos: T[], currentIndex: number, count = 3): T[] {
  const list = videos.filter((v) => v.durationSec > 0);
  return Array.from({ length: Math.min(count, Math.max(0, list.length - 1)) }, (_, i) => list[(currentIndex + 1 + i) % list.length]);
}

// ─────────────────────────────────────────────────────────────
// Commercial breaks
// ─────────────────────────────────────────────────────────────

export interface Spot { id: string; durationSec: number; weight: number }
export interface BreakConfig { enabled: boolean; breakEvery: number; breakSeconds: number }

export type BreakItem =
  | { type: "commercial"; id: string; startSec: number; durationSec: number }
  | { type: "card"; startSec: number; durationSec: number }; // station bumper filling leftover time

export type ChannelNow =
  | { type: "video"; videoId: string; index: number; offsetSec: number; remainingSec: number }
  | { type: "commercial"; spotId: string; offsetSec: number; remainingSec: number; breakRemainingSec: number }
  | { type: "card"; offsetSec: number; remainingSec: number; breakRemainingSec: number };

/** Small deterministic PRNG so every viewer computes the same "random" break. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fill one break of `breakSeconds` with randomly chosen spots (weighted, no
 * repeats inside a break). Spots that don't fit are skipped; leftover time
 * becomes a station bumper card. Same seed ⇒ same break for every viewer.
 */
export function fillBreak(spots: Spot[], breakSeconds: number, seed: number): BreakItem[] {
  const rnd = mulberry32(seed);
  const pool = spots.filter((s) => s.durationSec > 0 && s.durationSec <= breakSeconds).map((s) => ({ ...s, w: Math.max(1, Math.min(10, s.weight)) }));
  const out: BreakItem[] = [];
  let t = 0;
  while (pool.length) {
    const fits = pool.filter((s) => s.durationSec <= breakSeconds - t);
    if (!fits.length) break;
    const total = fits.reduce((n, s) => n + s.w, 0);
    let r = rnd() * total;
    const pick = fits.find((s) => (r -= s.w) < 0) ?? fits[fits.length - 1];
    out.push({ type: "commercial", id: pick.id, startSec: t, durationSec: pick.durationSec });
    t += pick.durationSec;
    pool.splice(pool.indexOf(pick), 1);
  }
  if (breakSeconds - t >= 1) out.push({ type: "card", startSec: t, durationSec: breakSeconds - t });
  return out;
}

/** Number of breaks per cycle: one after every `breakEvery` videos (at least one per cycle). */
export function breaksPerCycle(videoCount: number, cfg: BreakConfig, hasSpots: boolean): number {
  if (!cfg.enabled || !hasSpots || cfg.breakEvery < 1 || cfg.breakSeconds < 5 || videoCount === 0) return 0;
  return Math.max(1, Math.floor(videoCount / cfg.breakEvery));
}

/**
 * Where is the channel right now? Videos loop from `origin`; a break of fixed
 * length follows every `breakEvery` videos, so the cycle length is constant
 * and every viewer lands on the same video, spot or bumper.
 */
export function channelNow(videos: RotationVideo[], spots: Spot[], cfg: BreakConfig, now: number, origin = TV_EPOCH): ChannelNow | null {
  const list = videos.filter((v) => v.durationSec > 0);
  if (!list.length) return null;
  const nBreaks = breaksPerCycle(list.length, cfg, spots.some((s) => s.durationSec > 0 && s.durationSec <= cfg.breakSeconds));
  const every = nBreaks ? Math.ceil(list.length / nBreaks) : Infinity;
  const cycle = list.reduce((s, v) => s + v.durationSec, 0) + nBreaks * cfg.breakSeconds;
  const elapsed = (now - origin) / 1000;
  const cycleIndex = Math.floor(elapsed / cycle);
  let t = ((elapsed % cycle) + cycle) % cycle;
  let breakIndex = 0;
  for (let i = 0; i < list.length; i++) {
    if (t < list[i].durationSec) return { type: "video", videoId: list[i].id, index: i, offsetSec: t, remainingSec: list[i].durationSec - t };
    t -= list[i].durationSec;
    const isBreakAfter = nBreaks > 0 && ((i + 1) % every === 0 || i === list.length - 1) && breakIndex < nBreaks;
    if (isBreakAfter) {
      if (t < cfg.breakSeconds) {
        const items = fillBreak(spots, cfg.breakSeconds, cycleIndex * 1009 + breakIndex * 7919 + 17);
        const cur = items.find((it) => t >= it.startSec && t < it.startSec + it.durationSec) ?? items[items.length - 1];
        const off = t - cur.startSec;
        const base = { offsetSec: off, remainingSec: cur.durationSec - off, breakRemainingSec: cfg.breakSeconds - t };
        return cur.type === "commercial" ? { type: "commercial", spotId: cur.id, ...base } : { type: "card", ...base };
      }
      t -= cfg.breakSeconds;
      breakIndex++;
    }
  }
  return { type: "video", videoId: list[0].id, index: 0, offsetSec: 0, remainingSec: list[0].durationSec };
}

// ─────────────────────────────────────────────────────────────
// TV schedule blocks (e.g. Saturday Morning Cartoons)
// ─────────────────────────────────────────────────────────────

export interface TvBlockInput { id: string; days: number[]; startMinute: number; endMinute: number; active: boolean }

export function validateBlock(b: Omit<TvBlockInput, "id" | "active">): string | null {
  if (!b.days.length || b.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return "Pick at least one day";
  if (b.startMinute < 0 || b.endMinute > 1440 || b.endMinute <= b.startMinute) return "End time must be after start time (same day)";
  return null;
}

export function blocksOverlap(a: Omit<TvBlockInput, "active">, b: Omit<TvBlockInput, "active">): boolean {
  return a.id !== b.id && a.days.some((d) => b.days.includes(d)) && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** The block on air at a station-local day/minute, if any. */
export function activeBlock<T extends TvBlockInput>(blocks: T[], isoDay: number, minute: number): T | null {
  return blocks.find((b) => b.active && b.days.includes(isoDay) && b.startMinute <= minute && minute < b.endMinute) ?? null;
}
