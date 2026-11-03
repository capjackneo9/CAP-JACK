import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rotationPosition, upNext } from "@/lib/tv/rotation";
import { liveVideoStatus } from "@/lib/tv/live";

export const dynamic = "force-dynamic";

/** What NCVR TV is showing right now: the live feed if someone is broadcasting, else the rotation. */
export async function GET() {
  const live = await liveVideoStatus();
  if (live.live && live.hlsUrl) {
    return NextResponse.json({ mode: "live", hlsUrl: live.hlsUrl, serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  }
  let videos: Array<{ id: string; title: string; artistName: string; durationSec: number; posterPath: string | null }> = [];
  try {
    videos = await db.musicVideo.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, artistName: true, durationSec: true, posterPath: true },
    });
  } catch {
    return NextResponse.json({ mode: "off", reason: "The station database is not reachable." }, { status: 503 });
  }
  const now = Date.now();
  const pos = rotationPosition(videos, now);
  if (!pos) return NextResponse.json({ mode: "off", reason: "No music videos are in rotation yet.", liveConfigured: live.configured });
  const cur = videos.find((v) => v.id === pos.videoId)!;
  return NextResponse.json({
    mode: "rotation",
    serverTime: now,
    video: { id: cur.id, title: cur.title, artist: cur.artistName, src: `/api/tv/video/${cur.id}`, durationSec: cur.durationSec },
    offsetSec: pos.offsetSec,
    remainingSec: pos.remainingSec,
    next: upNext(videos, pos.index, 3).map((v) => ({ title: v.title, artist: v.artistName })),
    liveConfigured: live.configured,
  }, { headers: { "Cache-Control": "no-store" } });
}
