import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { isCategory } from "@/lib/categories";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const GET = guarded("library.view", async (req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const station = await requireStation();
  const tracks = await db.track.findMany({
    where: {
      stationId: station.id,
      ...(status ? { status: status as "APPROVED" } : {}),
      ...(category && isCategory(category) ? { category } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { tracks };
});

const meta = z.object({
  title: z.string().trim().min(1).max(200),
  artistName: z.string().trim().min(1).max(200),
  album: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(80).optional(),
  category: z.string().refine(isCategory, "Unknown category"),
  isrc: z.string().trim().max(20).optional(),
  credits: z.string().trim().max(1000).optional(),
  explicit: z.string().optional(),
  rightsConfirmed: z.literal("on", { message: "Confirm you hold broadcast rights for this file" }),
  durationSec: z.coerce.number().int().min(0).max(36000).optional(),
});

export const POST = guarded("library.upload", async (req, actor) => {
  const form = await req.formData();
  const d = meta.parse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== "")));
  const station = await requireStation();
  try {
    const audio = await saveUpload(form.get("audio") as File, "audio", "library");
    const art = form.get("artwork");
    const artwork = art instanceof File && art.size > 0 ? await saveUpload(art, "image", "artwork") : null;
    const track = await db.track.create({
      data: {
        stationId: station.id, title: d.title, artistName: d.artistName, album: d.album, genre: d.genre, category: d.category as never,
        isrc: d.isrc, credits: d.credits, explicit: d.explicit === "on", rightsConfirmed: true, durationSec: d.durationSec,
        filePath: audio.key, fileMime: audio.type.mime, fileSize: audio.size, artworkPath: artwork?.key ?? null,
        status: "PENDING_REVIEW",
      },
    });
    await audit({ userId: actor.id, action: "library.upload", target: `track:${track.id}`, details: { title: track.title } });
    return { track };
  } catch (e) {
    if (e instanceof UploadError) throw new HttpError(400, e.message);
    throw e;
  }
});
