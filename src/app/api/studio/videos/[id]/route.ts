import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { unlink } from "node:fs/promises";
import { audit } from "@/lib/audit";
import { resolveKey } from "@/lib/storage";

const body = z.object({
  action: z.enum(["approve", "reject", "archive", "update"]),
  title: z.string().trim().min(1).max(200).optional(),
  artistName: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(300).nullable().optional().transform((v) => (v === "" ? null : v)),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  kind: z.enum(["MUSIC_VIDEO", "CARTOON", "PROGRAM", "MOVIE", "COMMERCIAL"]).optional(),
  advertiser: z.string().trim().max(200).nullable().optional(),
  startsOn: z.coerce.date().nullable().optional(),
  endsOn: z.coerce.date().nullable().optional(),
  weight: z.number().int().min(1).max(10).optional(),
});

export const PATCH = guarded<{ id: string }>("video.manage", async (req, actor, { id }) => {
  const b = body.parse(await req.json());
  const v = await db.musicVideo.findUnique({ where: { id } });
  if (!v) throw new HttpError(404, "Video not found");
  const data =
    b.action === "approve" ? { status: "APPROVED" as const }
    : b.action === "reject" ? { status: "REJECTED" as const }
    : b.action === "archive" ? { status: "ARCHIVED" as const }
    : { title: b.title, artistName: b.artistName, description: b.description, sortOrder: b.sortOrder, kind: b.kind, advertiser: b.advertiser, startsOn: b.startsOn, endsOn: b.endsOn, weight: b.weight };
  if (b.action === "approve" && !v.rightsConfirmed) throw new HttpError(400, "Rights must be confirmed before a video can air");
  const updated = await db.musicVideo.update({ where: { id }, data });
  await audit({ userId: actor.id, action: `video.${b.action}`, target: `video:${id}`, liveImpact: b.action !== "update" });
  return { video: updated };
});

/** Delete a video for good: its record, its files, and any block feature slot pointing at it. */
export const DELETE = guarded<{ id: string }>("video.manage", async (_req, actor, { id }) => {
  const v = await db.musicVideo.findUnique({ where: { id } });
  if (!v) throw new HttpError(404, "Video not found");
  await db.$transaction([
    db.tvBlock.updateMany({ where: { featureVideoId: id }, data: { featureVideoId: null, featureStartMinute: null, featureDate: null } }),
    db.musicVideo.delete({ where: { id } }),
  ]);
  const keys = [v.filePath, v.posterPath?.startsWith("/api/media/") ? v.posterPath.slice("/api/media/".length) : null].filter((k): k is string => Boolean(k));
  await Promise.all(keys.map((k) => { try { return unlink(resolveKey(k)).catch(() => null); } catch { return null; } }));
  await audit({ userId: actor.id, action: "video.delete", target: `video:${id}`, details: { kind: v.kind, title: v.title, artist: v.artistName }, liveImpact: v.status === "APPROVED" });
  return { deleted: true };
});
