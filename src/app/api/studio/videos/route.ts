import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { liveVideoStatus } from "@/lib/tv/live";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export const GET = guarded("video.manage", async () => {
  const [videos, live] = await Promise.all([
    db.musicVideo.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    liveVideoStatus(),
  ]);
  return { videos, live, rtmpUrl: config.liveVideo.rtmpUrl ?? null, path: config.liveVideo.path };
});

const meta = z.object({
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(200),
  durationSec: z.coerce.number().int().min(5, "Could not read the video length — try another browser or file").max(4 * 3600),
  rightsConfirmed: z.literal("on", { message: "Confirm you have the rights to broadcast this video" }),
});

export const POST = guarded("video.manage", async (req, actor) => {
  const form = await req.formData();
  const d = meta.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== "")));
  const station = await requireStation();
  try {
    const video = await saveUpload(form.get("video") as File, "video", "videos");
    const poster = form.get("poster");
    const posterUp = poster instanceof File && poster.size > 0 ? await saveUpload(poster, "image", "public-art") : null;
    const last = await db.musicVideo.aggregate({ _max: { sortOrder: true } });
    const v = await db.musicVideo.create({
      data: {
        stationId: station.id, title: d.title, artistName: d.artistName, durationSec: d.durationSec, rightsConfirmed: true,
        filePath: video.key, fileMime: video.type.mime, fileSize: video.size, posterPath: posterUp ? `/api/media/${posterUp.key}` : null,
        sortOrder: (last._max.sortOrder ?? 0) + 10, createdById: actor.id,
      },
    });
    await audit({ userId: actor.id, action: "video.upload", target: `video:${v.id}`, details: { title: v.title } });
    return { video: v };
  } catch (e) {
    if (e instanceof UploadError) throw new HttpError(400, e.message);
    throw e;
  }
});
