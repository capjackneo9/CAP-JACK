import { NextResponse } from "next/server";
import { z } from "zod";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const TYPES = ["INTERVIEW", "COMMERCIAL_SPOT", "COMMERCIAL_PRODUCTION", "SHOW_SPONSORSHIP", "ARTIST_SHOWCASE", "HOSTED_SHOW", "OTHER"] as const;

const schema = z.object({
  type: z.enum(TYPES),
  productSlug: z.string().optional(),
  contactName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  organization: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  details: z.string().trim().min(10, "Please add a few details").max(5000),
  preferredDates: z.string().trim().max(300).optional(),
  disclosure: z.string().optional(),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: Request) {
  if (!rateLimit(`book:${clientIp(req)}`, 6)) return NextResponse.json({ error: "Too many requests — please try again later." }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const parsed = schema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const d = parsed.data;
  const sponsored = ["COMMERCIAL_SPOT", "SHOW_SPONSORSHIP"].includes(d.type);
  if (sponsored && d.disclosure !== "on") {
    return NextResponse.json({ error: "Sponsored content must be acknowledged as disclosed on-air and online." }, { status: 400 });
  }
  try {
    const station = await requireStation();
    const media = form.get("media");
    let mediaPath: string | null = null;
    if (media instanceof File && media.size > 0) {
      const isImage = media.type.startsWith("image/");
      mediaPath = (await saveUpload(media, isImage ? "image" : "audio", "bookings")).key;
    }
    const product = d.productSlug ? await db.product.findFirst({ where: { stationId: station.id, slug: d.productSlug } }) : null;
    const b = await db.booking.create({
      data: {
        stationId: station.id, type: d.type, productId: product?.id ?? null, contactName: d.contactName, email: d.email.toLowerCase(),
        organization: d.organization || null, phone: d.phone || null, details: d.details, preferredDates: d.preferredDates || null,
        mediaPath, disclosureAcknowledged: d.disclosure === "on",
      },
    });
    // Payment for bookings is collected after the station approves and quotes the request (no pay-to-air).
    return NextResponse.json({ ok: true, reference: b.id });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[booking]", e);
    return NextResponse.json({ error: "Request could not be saved. Please try again later." }, { status: 500 });
  }
}
