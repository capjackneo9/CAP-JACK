import { NextResponse } from "next/server";
import { streamUpload } from "@/lib/stream-file";

export const runtime = "nodejs";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Public artwork only (show/host images). Audio and private uploads are never served here. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const parts = (await params).key;
  if (parts.length !== 2 || parts[0] !== "public-art" || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(parts[1])) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const res = await streamUpload(req, parts.join("/"), MIME[parts[1].split(".").pop()!]);
    res.headers.set("Cache-Control", "public, max-age=86400");
    return res;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
