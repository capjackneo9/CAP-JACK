import { guarded } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertBlockFits, blockBody } from "@/lib/tv/blocks";

export const POST = guarded("video.manage", async (req, actor) => {
  const b = blockBody.parse(await req.json());
  await assertBlockFits(b);
  const block = await db.tvBlock.create({ data: b });
  await audit({ userId: actor.id, action: "tv.block.create", target: `tvblock:${block.id}`, details: { title: block.title } });
  return { block };
});
