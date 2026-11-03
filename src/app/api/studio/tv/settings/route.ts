import { z } from "zod";
import { guarded } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { audit } from "@/lib/audit";
import { LOGO_POSITIONS, LOGO_SIZES } from "@/lib/tv/rotation";
import { tvSettings } from "@/lib/tv/settings";

const imagePath = z.string().regex(/^\/(api\/media\/public-art\/[a-f0-9-]+\.(jpg|png|webp)|brand\/[a-z0-9-]+\.(webp|png|jpg))$/, "Invalid image");

const body = z.object({
  enabled: z.boolean().optional(),
  breakEvery: z.number().int().min(1, "Break every 1–20 videos").max(20, "Break every 1–20 videos").optional(),
  breakSeconds: z.number().int().min(15, "Breaks must be 15–600 seconds").max(600, "Breaks must be 15–600 seconds").optional(),
  bugPath: imagePath.nullable().optional(),
  bugPosition: z.enum(LOGO_POSITIONS).optional(),
  bugSize: z.enum(LOGO_SIZES).optional(),
  bugOpacity: z.number().int().min(20).max(100).optional(),
  layout: z.enum(["logo-top", "player-top"]).optional(),
});

export const PUT = guarded("video.manage", async (req, actor) => {
  const b = body.parse(await req.json());
  const station = await requireStation();
  const s = await db.station.update({
    where: { id: station.id },
    data: {
      tvCommercialsEnabled: b.enabled, tvBreakEvery: b.breakEvery, tvBreakSeconds: b.breakSeconds,
      tvBugPath: b.bugPath, tvBugPosition: b.bugPosition, tvBugSize: b.bugSize, tvBugOpacity: b.bugOpacity, tvLayout: b.layout,
    },
  });
  await audit({ userId: actor.id, action: "tv.settings.update", details: b, liveImpact: true });
  return { settings: tvSettings(s) };
});

