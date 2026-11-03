import { guarded, HttpError } from "@/lib/api";
import { saveUpload, UploadError } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Upload an on-screen logo / channel image (PNG with transparency recommended). */
export const POST = guarded("video.manage", async (req, actor) => {
  const form = await req.formData();
  try {
    const up = await saveUpload(form.get("image") as File, "image", "public-art");
    await audit({ userId: actor.id, action: "tv.image.upload", target: up.key });
    return { path: `/api/media/${up.key}` };
  } catch (e) {
    if (e instanceof UploadError) throw new HttpError(400, e.message);
    throw e;
  }
});
