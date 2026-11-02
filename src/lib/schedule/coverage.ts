import {
  DAY_NAMES, MINUTES_PER_DAY, MINUTES_PER_WEEK,
  type Interval, type OverrideInput, type ProgramInput, type SlotInput,
} from "./types";
import { formatMinute, toStationTime, weekMinute } from "./time";

export interface SlotIssue {
  kind: "invalid";
  slot: SlotInput;
  message: string;
}
export interface GapIssue {
  kind: "gap";
  start: number; // week minute
  end: number;
  message: string;
}
export interface ConflictIssue {
  kind: "conflict";
  a: SlotInput;
  b: SlotInput;
  start: number;
  end: number;
  message: string;
}
export type ScheduleIssue = SlotIssue | GapIssue | ConflictIssue;

export interface CoverageReport {
  coveredMinutes: number;
  totalMinutes: number;
  fullyCovered: boolean;
  /** True when every gap can be filled by the active fallback program. */
  fallbackAvailable: boolean;
  gaps: GapIssue[];
  conflicts: ConflictIssue[];
  invalid: SlotIssue[];
  ok: boolean;
}

export function describeWeekMinute(wm: number): string {
  const day = Math.floor(wm / MINUTES_PER_DAY) + 1;
  return `${DAY_NAMES[day]} ${formatMinute(wm % MINUTES_PER_DAY)}`;
}

export function validateSlot(slot: SlotInput): string | null {
  if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 1 || slot.dayOfWeek > 7) return "Day must be 1 (Mon) – 7 (Sun)";
  if (!Number.isInteger(slot.startMinute) || !Number.isInteger(slot.endMinute)) return "Times must be whole minutes";
  if (slot.startMinute < 0 || slot.startMinute >= MINUTES_PER_DAY) return "Start must be within the day";
  if (slot.endMinute <= slot.startMinute) return "End must be after start (split overnight shows at midnight)";
  if (slot.endMinute > MINUTES_PER_DAY) return "End cannot pass midnight (split overnight shows at midnight)";
  return null;
}

export function slotInterval(slot: SlotInput): Interval {
  const base = (slot.dayOfWeek - 1) * MINUTES_PER_DAY;
  return { start: base + slot.startMinute, end: base + slot.endMinute };
}

/** Merge overlapping/adjacent intervals. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ ...iv });
  }
  return out;
}

/**
 * Validate a standard week: every one of the 168 hours must be covered by an
 * active program, and exclusive programs may not overlap one another.
 */
export function analyzeSchedule(programs: ProgramInput[], slots: SlotInput[]): CoverageReport {
  const byId = new Map(programs.map((p) => [p.id, p]));
  const invalid: SlotIssue[] = [];
  const activeSlots: SlotInput[] = [];

  for (const slot of slots) {
    const err = validateSlot(slot);
    const program = byId.get(slot.programId);
    if (err) invalid.push({ kind: "invalid", slot, message: err });
    else if (!program) invalid.push({ kind: "invalid", slot, message: "Slot references an unknown program" });
    else if (program.active) activeSlots.push(slot);
  }

  const merged = mergeIntervals(activeSlots.map(slotInterval));
  const gaps: GapIssue[] = [];
  let cursor = 0;
  let covered = 0;
  for (const iv of merged) {
    if (iv.start > cursor) gaps.push(gap(cursor, iv.start));
    covered += iv.end - iv.start;
    cursor = Math.max(cursor, iv.end);
  }
  if (cursor < MINUTES_PER_WEEK) gaps.push(gap(cursor, MINUTES_PER_WEEK));

  const conflicts: ConflictIssue[] = [];
  const exclusive = activeSlots
    .filter((s) => byId.get(s.programId)?.exclusive)
    .map((s) => ({ s, iv: slotInterval(s) }))
    .sort((a, b) => a.iv.start - b.iv.start);
  for (let i = 0; i < exclusive.length; i++) {
    for (let j = i + 1; j < exclusive.length; j++) {
      const a = exclusive[i];
      const b = exclusive[j];
      if (b.iv.start >= a.iv.end) break;
      const start = Math.max(a.iv.start, b.iv.start);
      const end = Math.min(a.iv.end, b.iv.end);
      const ta = byId.get(a.s.programId)?.title ?? a.s.programId;
      const tb = byId.get(b.s.programId)?.title ?? b.s.programId;
      conflicts.push({
        kind: "conflict", a: a.s, b: b.s, start, end,
        message: `"${ta}" and "${tb}" overlap ${describeWeekMinute(start)} – ${describeWeekMinute(end)}`,
      });
    }
  }

  const fallbackAvailable = programs.some((p) => p.isFallback && p.active);
  return {
    coveredMinutes: covered,
    totalMinutes: MINUTES_PER_WEEK,
    fullyCovered: gaps.length === 0,
    fallbackAvailable,
    gaps,
    conflicts,
    invalid,
    ok: gaps.length === 0 && conflicts.length === 0 && invalid.length === 0,
  };
}

function gap(start: number, end: number): GapIssue {
  return { kind: "gap", start, end, message: `No programming ${describeWeekMinute(start)} – ${describeWeekMinute(end)}` };
}

export interface Resolved {
  programId: string;
  source: "override" | "schedule" | "fallback";
  /** Week minute the current block started / ends (for schedule source). */
  startMinute?: number;
  endMinute?: number;
}

/**
 * What should be on air at `at`? Priority: active override → scheduled slot →
 * fallback program (the default Caprio rotation). Returns null only when no
 * fallback exists, which validation reports as an error.
 */
export function resolveProgram(
  at: Date,
  timeZone: string,
  programs: ProgramInput[],
  slots: SlotInput[],
  overrides: OverrideInput[] = [],
): Resolved | null {
  const active = new Map(programs.filter((p) => p.active).map((p) => [p.id, p]));
  const ov = overrides
    .filter((o) => active.has(o.programId) && o.startsAt <= at && at < o.endsAt)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0];
  if (ov) return { programId: ov.programId, source: "override" };

  const wm = weekMinute(toStationTime(at, timeZone));
  const match = slots
    .filter((s) => active.has(s.programId) && !validateSlot(s))
    .map((s) => ({ s, iv: slotInterval(s) }))
    .filter(({ iv }) => iv.start <= wm && wm < iv.end)
    // Prefer exclusive programs, then the most specific (shortest) slot.
    .sort((a, b) => {
      const ea = active.get(a.s.programId)!.exclusive ? 0 : 1;
      const eb = active.get(b.s.programId)!.exclusive ? 0 : 1;
      return ea - eb || (a.iv.end - a.iv.start) - (b.iv.end - b.iv.start);
    })[0];
  if (match) return { programId: match.s.programId, source: "schedule", startMinute: match.iv.start, endMinute: match.iv.end };

  const fb = programs.find((p) => p.isFallback && p.active);
  return fb ? { programId: fb.id, source: "fallback" } : null;
}
