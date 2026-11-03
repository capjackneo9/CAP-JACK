import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { presetDataSchema } from "@/lib/console/preset";

export const GET = guarded("console.broadcast", async (_req, actor) => {
  const presets = await db.consolePreset.findMany({ where: { userId: actor.id }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  return { presets };
});

const body = z.object({ name: z.string().trim().min(1).max(80), data: presetDataSchema, isDefault: z.boolean().optional() });

export const POST = guarded("console.broadcast", async (req, actor) => {
  const b = body.parse(await req.json());
  if ((await db.consolePreset.count({ where: { userId: actor.id } })) >= 50) throw new HttpError(409, "Preset limit reached (50) — delete one first");
  const makeDefault = b.isDefault || (await db.consolePreset.count({ where: { userId: actor.id } })) === 0;
  const preset = await db.$transaction(async (tx) => {
    if (makeDefault) await tx.consolePreset.updateMany({ where: { userId: actor.id }, data: { isDefault: false } });
    return tx.consolePreset.create({ data: { userId: actor.id, name: b.name, data: b.data, isDefault: makeDefault } });
  });
  return { preset };
});
