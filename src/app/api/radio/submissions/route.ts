import { NextResponse } from "next/server";
import { z } from "zod";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createCheckout } from "@/lib/payments";

export const runtime = "nodejs";

const schema = z.object({
  artistName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  songTitle: z.string().trim().min(1).max(200),
  genre: z.string().trim().min(1).max(80),
  bio: z.string().trim().min(20, "Biography should be at least 20 characters").max(2000),
  aiGenerated: z.enum(["yes", "no"]),
  aiToolsUsed: z.string().trim().max(300).optional(),
  commercialRights: z.literal("on", { message: "You must confirm commercial-use rights" }),
  broadcastPermission: z.literal("on", { message: "You must grant broadcast permission" }),
  promoPackage: z.string().optional(),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: Request) {
  if (!rateLimit(`sub:${clientIp(req)}`, 5)) return NextResponse.json({ error: "Too many submissions — please try again later." }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const parsed = schema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission" }, { status: 400 });
  const d = parsed.data;

  try {
    const station = await requireStation();
    const audio = await saveUpload(form.get("audio") as File, "audio", "submissions");
    const art = form.get("artwork");
    const artwork = art instanceof File && art.size > 0 ? await saveUpload(art, "image", "artwork") : null;

    const product = d.promoPackage
      ? await db.product.findFirst({ where: { stationId: station.id, slug: d.promoPackage, active: true } })
      : null;

    const sub = await db.submission.create({
      data: {
        stationId: station.id, artistName: d.artistName, email: d.email.toLowerCase(), songTitle: d.songTitle, genre: d.genre, bio: d.bio,
        aiGenerated: d.aiGenerated === "yes", aiToolsUsed: d.aiToolsUsed || null,
        audioPath: audio.key, audioMime: audio.type.mime, audioSize: audio.size, artworkPath: artwork?.key ?? null,
        commercialRightsConfirmed: true, broadcastPermissionGranted: true,
        promoPackage: product?.slug ?? null, status: "SUBMITTED", paymentStatus: product?.priceMinCents ? "PENDING" : "NONE",
        history: [{ at: new Date().toISOString(), status: "SUBMITTED", by: "artist" }],
      },
    });

    let checkoutUrl: string | null = null;
    if (product?.priceMinCents) {
      checkoutUrl = await createCheckout({
        name: product.name, description: "Editorial review fee. Payment does not guarantee acceptance or airplay.",
        amountCents: product.priceMinCents, email: sub.email, metadata: { kind: "submission", id: sub.id }, returnPath: "/radio/submit",
      });
    }
    return NextResponse.json({ ok: true, reference: sub.id, checkoutUrl, paymentConfigured: Boolean(checkoutUrl) });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[submission]", e);
    return NextResponse.json({ error: "Submission could not be saved. Please try again later." }, { status: 500 });
  }
}
