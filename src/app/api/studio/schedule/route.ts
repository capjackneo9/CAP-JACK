import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { loadSchedule } from "@/lib/schedule-data";
import { analyzeSchedule } from "@/lib/schedule";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = guarded("schedule.view", async () => {
  const { station: _s, ...rest } = await loadSchedule();
  return rest;
});

const slot = z.object({ programId: z.string(), dayOfWeek: z.number().int(), startMinute: z.number().int(), endMinute: z.number().int() });
const body = z.object({ slots: z.array(slot).max(2000) });

/** Save the weekly grid (local NCVR metadata). Publishing to AzuraCast is a separate, confirmed step. */
export const PUT = guarded("schedule.edit", async (req, actor) => {
  const { slots } = body.parse(await req.json());
  const station = await requireStation();
  const programs = await db.program.findMany({ where: { stationId: station.id } });
  const report = analyzeSchedule(programs, slots);
  if (report.invalid.length) throw new HttpError(422, report.invalid[0].message);
  if (report.conflicts.length) throw new HttpError(422, report.conflicts[0].message);
  if (!report.fullyCovered && !report.fallbackAvailable) throw new HttpError(422, "The week has gaps and no active fallback program to cover them.");
  const ids = new Set(programs.map((p) => p.id));
  await db.$transaction([
    db.scheduleSlot.deleteMany({ where: { programId: { in: [...ids] } } }),
    db.scheduleSlot.createMany({ data: slots.map((s) => ({ programId: s.programId, dayOfWeek: s.dayOfWeek, startMinute: s.startMinute, endMinute: s.endMinute })) }),
    // Local edits mark linked programs as needing a publish.
    db.program.updateMany({ where: { stationId: station.id, azuracastPlaylistId: { not: null } }, data: { syncState: "PENDING" } }),
  ]);
  await audit({ userId: actor.id, action: "schedule.save", details: { slots: slots.length, gaps: report.gaps.length } });
  return { ok: true, report };
});
