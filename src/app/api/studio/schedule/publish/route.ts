import { z } from "zod";
import { guarded, HttpError, requireConfirmation } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { engine } from "@/lib/azuracast/client";
import { slotsToAzuraSchedule } from "@/lib/azuracast/schedule";
import { analyzeSchedule, toStationTime, toAzuraTime } from "@/lib/schedule";
import { config, integrations } from "@/lib/config";
import { audit } from "@/lib/audit";
import type { AzScheduleItem } from "@/lib/azuracast/types";

const body = z.object({ confirm: z.string().optional() });

/**
 * Apply the saved schedule to AzuraCast playlists. Each program linked to a
 * playlist gets its weekly items (+ dated items for upcoming overrides).
 * Results are recorded per program so the UI can show what actually applied.
 */
export const POST = guarded("schedule.publish", async (req, actor) => {
  requireConfirmation(body.parse(await req.json()), "PUBLISH SCHEDULE");
  if (!integrations.azuracastAdmin()) throw new HttpError(503, "AzuraCast admin API is not configured");
  const station = await requireStation();
  const programs = await db.program.findMany({ where: { stationId: station.id }, include: { slots: true, overrides: { where: { endsAt: { gte: new Date() } } } } });
  const report = analyzeSchedule(programs, programs.flatMap((p) => p.slots));
  if (report.conflicts.length || report.invalid.length) throw new HttpError(422, "Fix schedule conflicts before publishing");
  if (!report.fullyCovered && !report.fallbackAvailable) throw new HttpError(422, "Gaps exist and there is no fallback program");

  const results: Array<{ program: string; state: "SYNCED" | "FAILED" | "SKIPPED"; message?: string }> = [];
  for (const p of programs) {
    if (!p.azuracastPlaylistId) { results.push({ program: p.title, state: "SKIPPED", message: "No AzuraCast playlist linked" }); continue; }
    // The fallback program's playlist stays an unscheduled general rotation so it fills every gap.
    const items: AzScheduleItem[] = !p.active || p.isFallback ? [] : slotsToAzuraSchedule(p.slots);
    if (p.active) {
      for (const o of p.overrides) {
        const s = toStationTime(o.startsAt, config.timezone);
        const e = toStationTime(o.endsAt, config.timezone);
        const date = (t: typeof s) => `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
        items.push({ start_time: toAzuraTime(s.minute), end_time: toAzuraTime(e.minute), start_date: date(s), end_date: date(e), days: [], loop_once: false });
      }
    }
    try {
      await engine().setPlaylistSchedule(p.azuracastPlaylistId, items);
      await db.program.update({ where: { id: p.id }, data: { syncState: "SYNCED", syncedAt: new Date(), syncError: null } });
      results.push({ program: p.title, state: "SYNCED" });
    } catch (e) {
      const message = (e as Error).message;
      await db.program.update({ where: { id: p.id }, data: { syncState: "FAILED", syncError: message } });
      results.push({ program: p.title, state: "FAILED", message });
    }
  }
  await audit({ userId: actor.id, action: "schedule.publish", liveImpact: true, details: { results } });
  return { results };
});
