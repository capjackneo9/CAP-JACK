import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

export const GET = guarded<{ id: string }>("console.broadcast", async (req, actor, { id }) => {
  const pad = await db.consolePadAsset.findUnique({ where: { id } });
  if (!pad || pad.userId !== actor.id) throw new HttpError(404, "Not found");
  return streamUpload(req, pad.key, pad.mime);
});
