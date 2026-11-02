import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

export const GET = guarded<{ id: string }>("library.view", async (req, _a, { id }) => {
  const t = await db.track.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "Not found");
  return streamUpload(req, t.filePath, t.fileMime);
});
