import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const body = z.object({
  action: z.enum(["approve", "reject", "archive", "update"]),
  title: z.string().trim().min(1).max(200).optional(),
  artistName: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

export const PATCH = guarded<{ id: string }>("video.manage", async (req, actor, { id }) => {
  const b = body.parse(await req.json());
  const v = await db.musicVideo.findUnique({ where: { id } });
  if (!v) throw new HttpError(404, "Video not found");
  const data =
    b.action === "approve" ? { status: "APPROVED" as const }
    : b.action === "reject" ? { status: "REJECTED" as const }
    : b.action === "archive" ? { status: "ARCHIVED" as const }
    : { title: b.title, artistName: b.artistName, sortOrder: b.sortOrder };
  if (b.action === "approve" && !v.rightsConfirmed) throw new HttpError(400, "Rights must be confirmed before a video can air");
  const updated = await db.musicVideo.update({ where: { id }, data });
  await audit({ userId: actor.id, action: `video.${b.action}`, target: `video:${id}`, liveImpact: b.action !== "update" });
  return { video: updated };
});
