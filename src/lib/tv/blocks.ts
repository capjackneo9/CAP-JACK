import "server-only";
import { z } from "zod";
import { db } from "../db";
import { HttpError } from "../api";
import { blocksOverlap, validateBlock, LOGO_POSITIONS, LOGO_SIZES } from "./rotation";

export const blockBody = z.object({
  title: z.string().trim().min(1).max(120),
  days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day"),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  kind: z.enum(["MUSIC_VIDEO", "CARTOON", "PROGRAM", "MOVIE"]),
  commercials: z.boolean().default(true),
  active: z.boolean().default(true),
  breakEvery: z.number().int().min(1).max(20).nullable().optional(),
  breakSeconds: z.number().int().min(15).max(600).nullable().optional(),
  logoPath: z.string().regex(/^\/(api\/media\/public-art\/[a-f0-9-]+\.(jpg|png|webp)|brand\/[a-z0-9-]+\.(webp|png|jpg))$/, "Invalid image").nullable().optional(),
  logoPosition: z.enum(LOGO_POSITIONS).nullable().optional(),
  logoSize: z.enum(LOGO_SIZES).nullable().optional(),
  featureVideoId: z.string().max(64).nullable().optional(),
  featureStartMinute: z.number().int().min(0).max(1439).nullable().optional(),
  featureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").nullable().optional(),
});

export async function assertBlockFits(b: z.infer<typeof blockBody>, id = "new") {
  const err = validateBlock(b);
  if (err) throw new HttpError(400, err);
  if (b.featureVideoId) {
    if (b.featureStartMinute == null) throw new HttpError(400, "Choose when the feature starts");
    const f = await db.musicVideo.findUnique({ where: { id: b.featureVideoId } });
    if (!f) throw new HttpError(400, "Feature video not found");
    if (b.featureStartMinute < b.startMinute || b.featureStartMinute + Math.ceil(f.durationSec / 60) > b.endMinute) {
      throw new HttpError(400, `The feature (${Math.ceil(f.durationSec / 60)} min) must start and finish inside the block`);
    }
  }
  if (!b.active) return;
  const others = await db.tvBlock.findMany({ where: { active: true, id: { not: id } } });
  const clash = others.find((o) => blocksOverlap({ ...b, id }, o));
  if (clash) throw new HttpError(409, `Overlaps “${clash.title}” — adjust the days or times`);
}
