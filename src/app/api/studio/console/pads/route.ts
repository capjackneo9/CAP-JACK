import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { MAX_PAD_BYTES } from "@/lib/files";

export const runtime = "nodejs";

/** Keep a pad sound loaded from the DJ's computer so presets can reload it later. */
export const POST = guarded("console.broadcast", async (req, actor) => {
  const form = await req.formData();
  const file = form.get("file") as File;
  const name = String(form.get("name") ?? "Pad").slice(0, 120);
  if ((await db.consolePadAsset.count({ where: { userId: actor.id } })) >= 200) throw new HttpError(409, "Pad storage limit reached (200 sounds)");
  try {
    const up = await saveUpload(file, "audio", "pads", MAX_PAD_BYTES);
    const pad = await db.consolePadAsset.create({ data: { userId: actor.id, name, key: up.key, mime: up.type.mime, size: up.size } });
    return { pad: { id: pad.id, name: pad.name } };
  } catch (e) {
    if (e instanceof UploadError) throw new HttpError(400, e.message);
    throw e;
  }
});
