import "server-only";
import { z } from "zod";
import { db } from "../db";
import { HttpError } from "../api";
import { blocksOverlap, validateBlock } from "./rotation";

export const blockBody = z.object({
  title: z.string().trim().min(1).max(120),
  days: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day"),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  kind: z.enum(["MUSIC_VIDEO", "CARTOON", "PROGRAM"]),
  commercials: z.boolean().default(true),
  active: z.boolean().default(true),
});

export async function assertBlockFits(b: z.infer<typeof blockBody>, id = "new") {
  const err = validateBlock(b);
  if (err) throw new HttpError(400, err);
  if (!b.active) return;
  const others = await db.tvBlock.findMany({ where: { active: true, id: { not: id } } });
  const clash = others.find((o) => blocksOverlap({ ...b, id }, o));
  if (clash) throw new HttpError(409, `Overlaps “${clash.title}” — adjust the days or times`);
}
