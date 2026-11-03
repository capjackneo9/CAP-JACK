import { NextResponse } from "next/server";
import { z } from "zod";
import { db, requireStation } from "@/lib/db";
import { saveUpload, UploadError } from "@/lib/storage";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isArea } from "@/lib/team/areas";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
  location: z.string().trim().max(120).optional(),
  hoursPerWeek: z.coerce.number().int().min(1).max(60).optional(),
  availability: z.string().trim().min(2, "Tell us when you're available").max(500),
  experience: z.string().trim().min(20, "Tell us a bit more about your experience (20+ characters)").max(4000),
  motivation: z.string().trim().min(20, "Tell us a bit more about why you want to join (20+ characters)").max(4000),
  portfolioUrl: z.string().trim().url("Portfolio / LinkedIn must be a full link starting with https://").max(400).optional(),
  ageConfirm: z.literal("on", { message: "Please confirm you are 18 or older" }),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: Request) {
  if (!rateLimit(`join:${clientIp(req)}`, 3)) return NextResponse.json({ error: "Too many applications from this connection — please try again later." }, { status: 429 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }
  const fields = Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string" && v !== "" && k !== "areas"));
  const parsed = schema.safeParse(fields);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid application" }, { status: 400 });
  const areas = form.getAll("areas").map(String).filter(isArea);
  if (!areas.length) return NextResponse.json({ error: "Choose at least one area you'd like to help with" }, { status: 400 });
  const d = parsed.data;
  try {
    const station = await requireStation();
    const resume = form.get("resume");
    const saved = resume instanceof File && resume.size > 0 ? await saveUpload(resume, "pdf", "resumes") : null;
    const app = await db.internApplication.create({
      data: {
        stationId: station.id, name: d.name, email: d.email.toLowerCase(), phone: d.phone || null, location: d.location || null,
        areas, hoursPerWeek: d.hoursPerWeek ?? null, availability: d.availability, experience: d.experience, motivation: d.motivation,
        portfolioUrl: d.portfolioUrl || null, resumePath: saved?.key ?? null, resumeMime: saved?.type.mime ?? null,
      },
    });
    return NextResponse.json({ ok: true, reference: app.id });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[join]", e);
    return NextResponse.json({ error: "Your application could not be saved. Please try again later." }, { status: 500 });
  }
}
