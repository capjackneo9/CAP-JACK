import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { saveUpload, UploadError } from "@/lib/storage";

export const runtime = "nodejs";

const body = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  format: z.enum(["LIVE", "PRERECORDED", "AUTOMATED"]).optional(),
  bucket: z.enum(["CAPRIO", "INDEPENDENT", "GUEST"]).optional(),
  hostId: z.string().nullable().optional(),
  sponsorId: z.string().nullable().optional(),
  featuredGuest: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  isFallback: z.boolean().optional(),
  azuracastPlaylistId: z.number().int().positive().nullable().optional(),
});

export const PATCH = guarded<{ id: string }>("schedule.edit", async (req, actor, { id }) => {
  const existing = await db.program.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Program not found");
  let data: z.infer<typeof body> & { imagePath?: string } = {};
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    try {
      const up = await saveUpload(form.get("image") as File, "image", "public-art");
      data.imagePath = `/api/media/${up.key}`;
    } catch (e) { if (e instanceof UploadError) throw new HttpError(400, e.message); throw e; }
  } else {
    data = body.parse(await req.json());
  }
  if (data.isFallback === true) {
    await db.program.updateMany({ where: { stationId: existing.stationId, id: { not: id } }, data: { isFallback: false } });
  }
  if (data.isFallback === false && existing.isFallback) throw new HttpError(409, "Choose another fallback program first — the station must always have one.");
  if (data.active === false && existing.isFallback) throw new HttpError(409, "The fallback program cannot be deactivated.");
  const program = await db.program.update({
    where: { id },
    data: { ...data, ...(data.azuracastPlaylistId !== undefined ? { syncState: data.azuracastPlaylistId ? "PENDING" : "NOT_LINKED" } : {}) },
  });
  await audit({ userId: actor.id, action: "program.update", target: `program:${id}`, details: JSON.parse(JSON.stringify(data)) });
  return { program };
});
