import { describe, expect, it } from "vitest";
import {
  analyzeSchedule, defaultScheduleInputs, resolveProgram, MINUTES_PER_WEEK, toStationTime, fromStationTime, weekMinute,
} from "@/lib/schedule";
import { slotsToAzuraSchedule, azuraEnd } from "@/lib/azuracast/schedule";

const TZ = "America/New_York";

describe("default NCVR schedule", () => {
  const { programs, slots } = defaultScheduleInputs();

  it("covers all 168 hours of the standard week", () => {
    const r = analyzeSchedule(programs, slots);
    expect(r.totalMinutes).toBe(168 * 60);
    expect(r.coveredMinutes).toBe(MINUTES_PER_WEEK);
    expect(r.gaps).toEqual([]);
    expect(r.fullyCovered).toBe(true);
  });

  it("has no conflicting exclusive shows and no invalid slots", () => {
    const r = analyzeSchedule(programs, slots);
    expect(r.conflicts).toEqual([]);
    expect(r.invalid).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("defines Caprio Radio Rotation as the fallback", () => {
    expect(programs.filter((p) => p.isFallback).map((p) => p.slug)).toEqual(["caprio-radio-rotation"]);
  });
});

describe("analyzeSchedule", () => {
  const programs = [
    { id: "a", slug: "a", title: "A", active: true, exclusive: true, isFallback: true },
    { id: "b", slug: "b", title: "B", active: true, exclusive: true, isFallback: false },
    { id: "c", slug: "c", title: "C", active: false, exclusive: true, isFallback: false },
  ];

  it("reports gaps", () => {
    const r = analyzeSchedule(programs, [{ programId: "a", dayOfWeek: 1, startMinute: 0, endMinute: 60 }]);
    expect(r.fullyCovered).toBe(false);
    expect(r.gaps[0]).toMatchObject({ start: 60, end: MINUTES_PER_WEEK });
    expect(r.fallbackAvailable).toBe(true);
  });

  it("detects exclusive conflicts", () => {
    const r = analyzeSchedule(programs, [
      { programId: "a", dayOfWeek: 2, startMinute: 0, endMinute: 120 },
      { programId: "b", dayOfWeek: 2, startMinute: 60, endMinute: 180 },
    ]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].start).toBe(1440 + 60);
    expect(r.conflicts[0].end).toBe(1440 + 120);
  });

  it("ignores inactive programs for coverage", () => {
    const r = analyzeSchedule(programs, [{ programId: "c", dayOfWeek: 1, startMinute: 0, endMinute: 1440 }]);
    expect(r.coveredMinutes).toBe(0);
  });

  it("rejects slots that cross midnight or are malformed", () => {
    const r = analyzeSchedule(programs, [
      { programId: "a", dayOfWeek: 1, startMinute: 1380, endMinute: 60 },
      { programId: "a", dayOfWeek: 8, startMinute: 0, endMinute: 60 },
      { programId: "zzz", dayOfWeek: 1, startMinute: 0, endMinute: 60 },
    ]);
    expect(r.invalid).toHaveLength(3);
  });
});

describe("resolveProgram", () => {
  const { programs, slots } = defaultScheduleInputs();

  it("resolves Monday 9 PM ET (EST, after DST ends) to The Nite Cap Experience", () => {
    // 2026-11-02 is a Monday; 21:00 EST = 02:00 UTC next day
    const r = resolveProgram(new Date("2026-11-03T02:00:00Z"), TZ, programs, slots);
    expect(r).toMatchObject({ programId: "the-nite-cap-experience", source: "schedule" });
  });

  it("resolves Saturday 10 AM ET (EDT) to The Metaphysical Matrix", () => {
    // 2026-07-11 is a Saturday; 10:00 EDT = 14:00 UTC
    const r = resolveProgram(new Date("2026-07-11T14:00:00Z"), TZ, programs, slots);
    expect(r?.programId).toBe("the-metaphysical-matrix");
  });

  it("falls back to the default Caprio rotation when a slot's program is deactivated", () => {
    const disabled = programs.map((p) => (p.id === "the-nite-cap-experience" ? { ...p, active: false } : p));
    const r = resolveProgram(new Date("2026-11-03T02:00:00Z"), TZ, disabled, slots);
    expect(r).toMatchObject({ programId: "caprio-radio-rotation", source: "fallback" });
  });

  it("returns null when nothing is scheduled and no fallback exists", () => {
    const noFallback = programs.map((p) => ({ ...p, isFallback: false }));
    expect(resolveProgram(new Date(), TZ, noFallback, [])).toBeNull();
  });

  it("gives temporary overrides priority", () => {
    const at = new Date("2026-11-03T02:00:00Z");
    const r = resolveProgram(at, TZ, programs, slots, [
      { programId: "ncvr-live-lounge", startsAt: new Date(at.getTime() - 60_000), endsAt: new Date(at.getTime() + 60_000) },
    ]);
    expect(r).toMatchObject({ programId: "ncvr-live-lounge", source: "override" });
  });
});

describe("station time conversion", () => {
  it("handles DST: same wall clock, different UTC offsets", () => {
    expect(fromStationTime(2026, 7, 1, 20 * 60, TZ).toISOString()).toBe("2026-07-02T00:00:00.000Z");
    expect(fromStationTime(2026, 12, 1, 20 * 60, TZ).toISOString()).toBe("2026-12-02T01:00:00.000Z");
  });
  it("computes week minutes from Monday midnight", () => {
    const t = toStationTime(new Date("2026-11-02T05:30:00Z"), TZ); // Mon 00:30 EST
    expect(t.isoDay).toBe(1);
    expect(weekMinute(t)).toBe(30);
  });
});

describe("AzuraCast schedule mapping", () => {
  it("groups weekdays and encodes HHMM with midnight wrap", () => {
    const items = slotsToAzuraSchedule([1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startMinute: 22 * 60, endMinute: 1440 })));
    expect(items).toEqual([{ start_time: 2200, end_time: 0, start_date: null, end_date: null, days: [1, 2, 3, 4, 5], loop_once: false }]);
  });
  it("encodes a full day as 0–2359", () => {
    expect(azuraEnd(0, 1440)).toBe(2359);
  });
});
