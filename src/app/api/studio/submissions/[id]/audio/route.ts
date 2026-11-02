import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

export const GET = guarded<{ id: string }>("submissions.review", async (req, _a, { id }) => {
  const s = await db.submission.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "Not found");
  return streamUpload(req, s.audioPath, s.audioMime);
});
