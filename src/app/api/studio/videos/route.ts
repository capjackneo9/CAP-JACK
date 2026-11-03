import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { liveVideoStatus } from "@/lib/tv/live";
import { config } from "@/lib/config";
import { tvSettings } from "@/lib/tv/settings";

export const runtime = "nodejs";

/** Create the default "Saturday Morning Cartoons" block the first time NCVR TV is opened. */
async function ensureDefaultBlocks() {
  if ((await db.tvBlock.count()) > 0) return;
  await db.tvBlock.create({
    data: {
      title: "Saturday Vibe Amerime", days: [6], startMinute: 9 * 60, endMinute: 11 * 60, kind: "CARTOON", commercials: true,
      breakEvery: 1, breakSeconds: 30, logoPath: "/brand/saturday-vibe-amerime.webp", logoPosition: "top-left", logoSize: "md",
    },
  });
}

export const GET = guarded("video.manage", async () => {
  await ensureDefaultBlocks();
  const station = await requireStation();
  const [videos, live, blocks] = await Promise.all([
    db.musicVideo.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    liveVideoStatus(),
    db.tvBlock.findMany({ orderBy: [{ startMinute: "asc" }] }),
  ]);
  return {
    videos, live, blocks, rtmpUrl: config.liveVideo.rtmpUrl ?? null, path: config.liveVideo.path,
    settings: tvSettings(station),
  };
});

const meta = z.object({
  kind: z.enum(["MUSIC_VIDEO", "CARTOON", "PROGRAM", "MOVIE", "COMMERCIAL"]).default("MUSIC_VIDEO"),
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(200),
  advertiser: z.string().trim().max(200).optional(),
  startsOn: z.coerce.date().optional(),
  endsOn: z.coerce.date().optional(),
  weight: z.coerce.number().int().min(1).max(10).optional(),
  durationSec: z.coerce.number().int().min(5, "Could not read the video length — try another browser or file").max(4 * 3600),
  rightsConfirmed: z.literal("on", { message: "Confirm you have the rights to broadcast this video" }),
});

export const POST = guarded("video.manage", async (req, actor) => {
  const form = await req.formData();
  const d = meta.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== "")));
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) throw new HttpError(400, "End date must be after the start date");
  const station = await requireStation();
  try {
    const video = await saveUpload(form.get("video") as File, "video", "videos");
    const poster = form.get("poster");
    const posterUp = poster instanceof File && poster.size > 0 ? await saveUpload(poster, "image", "public-art") : null;
    const last = await db.musicVideo.aggregate({ _max: { sortOrder: true } });
    const v = await db.musicVideo.create({
      data: {
        stationId: station.id, kind: d.kind, title: d.title, artistName: d.artistName, durationSec: d.durationSec, rightsConfirmed: true,
        advertiser: d.kind === "COMMERCIAL" ? d.advertiser || d.artistName : null,
        startsOn: d.kind === "COMMERCIAL" ? d.startsOn ?? null : null,
        endsOn: d.kind === "COMMERCIAL" ? d.endsOn ?? null : null,
        weight: d.weight ?? 1,
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
