import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertBlockFits, blockBody } from "@/lib/tv/blocks";

export const PATCH = guarded<{ id: string }>("video.manage", async (req, actor, { id }) => {
  const existing = await db.tvBlock.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Block not found");
  const b = blockBody.parse({ ...existing, ...(await req.json()) });
  await assertBlockFits(b, id);
  const block = await db.tvBlock.update({ where: { id }, data: b });
  await audit({ userId: actor.id, action: "tv.block.update", target: `tvblock:${id}`, liveImpact: true });
  return { block };
});

export const DELETE = guarded<{ id: string }>("video.manage", async (_req, actor, { id }) => {
  await db.tvBlock.delete({ where: { id } }).catch(() => { throw new HttpError(404, "Block not found"); });
  await audit({ userId: actor.id, action: "tv.block.delete", target: `tvblock:${id}` });
  return { ok: true };
});
