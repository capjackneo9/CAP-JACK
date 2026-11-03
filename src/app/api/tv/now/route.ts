import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeBlock, channelNow, upNext, TV_EPOCH } from "@/lib/tv/rotation";
import { liveVideoStatus } from "@/lib/tv/live";
import { config } from "@/lib/config";
import { fromStationTime, toStationTime } from "@/lib/schedule/time";
import type { TvKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<TvKind, string> = { MUSIC_VIDEO: "Music videos", CARTOON: "Cartoons", PROGRAM: "Shows", COMMERCIAL: "Commercials" };

/**
 * What NCVR TV is showing right now:
 *  live feed → scheduled block (e.g. Saturday Morning Cartoons) → music-video rotation,
 *  with commercial breaks inserted on a shared clock.
 */
export async function GET() {
  const live = await liveVideoStatus();
  if (live.live && live.hlsUrl) {
    return NextResponse.json({ mode: "live", hlsUrl: live.hlsUrl, serverTime: Date.now() }, { headers: { "Cache-Control": "no-store" } });
  }
  const now = Date.now();
  try {
    const station = await db.station.findUnique({ where: { slug: "ncvr" } });
    const tz = station?.timezone ?? config.timezone;
    const lt = toStationTime(new Date(now), tz);
    const blocks = await db.tvBlock.findMany({ where: { active: true } });
    let block = activeBlock(blocks, lt.isoDay, lt.minute);

    const fetchKind = (kind: TvKind) => db.musicVideo.findMany({
      where: { kind, status: "APPROVED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, artistName: true, durationSec: true, advertiser: true },
    });
    let content = await fetchKind(block?.kind ?? "MUSIC_VIDEO");
    let origin = block ? fromStationTime(lt.year, lt.month, lt.day, block.startMinute, tz).getTime() : TV_EPOCH;
    if (block && content.length === 0) { // nothing uploaded for this block yet → regular rotation
      block = null;
      content = await fetchKind("MUSIC_VIDEO");
      origin = TV_EPOCH;
    }
    const day = new Date(now);
    const spots = await db.musicVideo.findMany({
      where: {
        kind: "COMMERCIAL", status: "APPROVED",
        AND: [{ OR: [{ startsOn: null }, { startsOn: { lte: day } }] }, { OR: [{ endsOn: null }, { endsOn: { gte: day } }] }],
      },
      select: { id: true, title: true, artistName: true, advertiser: true, durationSec: true, weight: true },
    });
    const cfg = {
      enabled: Boolean(station?.tvCommercialsEnabled) && (block ? block.commercials : true),
      breakEvery: station?.tvBreakEvery ?? 3,
      breakSeconds: station?.tvBreakSeconds ?? 90,
    };
    const pos = channelNow(content, spots, cfg, now, origin);
    const blockInfo = block ? { title: block.title, kind: block.kind, label: KIND_LABEL[block.kind] } : null;
    if (!pos) return NextResponse.json({ mode: "off", reason: "No videos are in rotation yet.", liveConfigured: live.configured, block: blockInfo });

    const base = { mode: "rotation", serverTime: now, offsetSec: pos.offsetSec, remainingSec: pos.remainingSec, block: blockInfo, liveConfigured: live.configured };
    if (pos.type === "video") {
      const v = content.find((x) => x.id === pos.videoId)!;
      return NextResponse.json({
        ...base,
        item: { type: "video", id: v.id, title: v.title, artist: v.artistName, src: `/api/tv/video/${v.id}`, durationSec: v.durationSec },
        next: upNext(content, pos.index, 3).map((x) => ({ title: x.title, artist: x.artistName })),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (pos.type === "commercial") {
      const s = spots.find((x) => x.id === pos.spotId)!;
      return NextResponse.json({
        ...base, breakRemainingSec: pos.breakRemainingSec,
        item: { type: "commercial", id: s.id, title: s.title, advertiser: s.advertiser ?? s.artistName, src: `/api/tv/video/${s.id}`, durationSec: s.durationSec },
        next: [],
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ...base, breakRemainingSec: pos.breakRemainingSec, item: { type: "card" }, next: [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[tv/now]", e);
    return NextResponse.json({ mode: "off", reason: "NCVR TV is temporarily unavailable." }, { status: 503 });
  }
}
