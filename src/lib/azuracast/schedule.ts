import { toAzuraTime } from "../schedule/time";
import type { AzScheduleItem } from "./types";

/**
 * Convert NCVR weekly slots for one program into AzuraCast schedule items.
 * Slots with the same start/end are grouped into one item with several days.
 * AzuraCast interprets times in the station's timezone (set it to America/New_York).
 */
export function slotsToAzuraSchedule(slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>): AzScheduleItem[] {
  const groups = new Map<string, { start: number; end: number; days: Set<number> }>();
  for (const s of slots) {
    const k = `${s.startMinute}-${s.endMinute}`;
    const g = groups.get(k) ?? { start: s.startMinute, end: s.endMinute, days: new Set<number>() };
    g.days.add(s.dayOfWeek);
    groups.set(k, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.start - b.start)
    .map((g) => ({
      start_time: toAzuraTime(g.start),
      end_time: azuraEnd(g.start, g.end),
      start_date: null,
      end_date: null,
      days: [...g.days].sort((a, b) => a - b),
      loop_once: false,
    }));
}

/**
 * AzuraCast treats an end_time earlier than start_time as "runs past midnight",
 * so a block ending at midnight is expressed as end_time 0. A full-day block
 * (00:00–24:00) is expressed as 0–2359.
 */
export function azuraEnd(start: number, end: number): number {
  if (end < 1440) return toAzuraTime(end);
  return start === 0 ? 2359 : 0;
}
