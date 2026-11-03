import { z } from "zod";
import { guarded } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { audit } from "@/lib/audit";

const body = z.object({
  enabled: z.boolean(),
  breakEvery: z.number().int().min(1, "Break every 1–20 videos").max(20, "Break every 1–20 videos"),
  breakSeconds: z.number().int().min(15, "Breaks must be 15–600 seconds").max(600, "Breaks must be 15–600 seconds"),
});

export const PUT = guarded("video.manage", async (req, actor) => {
  const b = body.parse(await req.json());
  const station = await requireStation();
  await db.station.update({ where: { id: station.id }, data: { tvCommercialsEnabled: b.enabled, tvBreakEvery: b.breakEvery, tvBreakSeconds: b.breakSeconds } });
  await audit({ userId: actor.id, action: "tv.breaks.update", details: b, liveImpact: true });
  return { settings: b };
});
