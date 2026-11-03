import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

export const GET = guarded<{ id: string }>("interns.review", async (req, _a, { id }) => {
  const app = await db.internApplication.findUnique({ where: { id } });
  if (!app?.resumePath) throw new HttpError(404, "No résumé on file");
  const res = await streamUpload(req, app.resumePath, "application/pdf");
  res.headers.set("Content-Disposition", `inline; filename="resume-${app.name.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
  return res;
});
