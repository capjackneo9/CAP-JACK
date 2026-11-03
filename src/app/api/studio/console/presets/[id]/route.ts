import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { presetDataSchema } from "@/lib/console/preset";

const body = z.object({ name: z.string().trim().min(1).max(80).optional(), data: presetDataSchema.optional(), isDefault: z.boolean().optional() });

async function own(id: string, userId: string) {
  const p = await db.consolePreset.findUnique({ where: { id } });
  if (!p || p.userId !== userId) throw new HttpError(404, "Preset not found");
  return p;
}

export const PATCH = guarded<{ id: string }>("console.broadcast", async (req, actor, { id }) => {
  await own(id, actor.id);
  const b = body.parse(await req.json());
  const preset = await db.$transaction(async (tx) => {
    if (b.isDefault) await tx.consolePreset.updateMany({ where: { userId: actor.id }, data: { isDefault: false } });
    return tx.consolePreset.update({ where: { id }, data: { name: b.name, data: b.data, isDefault: b.isDefault } });
  });
  return { preset };
});

export const DELETE = guarded<{ id: string }>("console.broadcast", async (_req, actor, { id }) => {
  await own(id, actor.id);
  await db.consolePreset.delete({ where: { id } });
  return { ok: true };
});
