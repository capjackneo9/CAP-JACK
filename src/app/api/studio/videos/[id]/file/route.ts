import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

/** Staff preview of any video (including ones not yet approved). */
export const GET = guarded<{ id: string }>("video.manage", async (req, _a, { id }) => {
  const v = await db.musicVideo.findUnique({ where: { id } });
  if (!v) throw new HttpError(404, "Not found");
  return streamUpload(req, v.filePath, v.fileMime);
});
