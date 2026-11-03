import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

/** Public video file for NCVR TV — approved videos only (Range-enabled for seeking). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await db.musicVideo.findUnique({ where: { id } }).catch(() => null);
  if (!v || v.status !== "APPROVED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const res = await streamUpload(req, v.filePath, v.fileMime);
  res.headers.set("Cache-Control", "public, max-age=3600");
  return res;
}
