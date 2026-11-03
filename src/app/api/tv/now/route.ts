import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeBlock, channelNow, featureOffset, resolveLook, upNext, TV_EPOCH } from "@/lib/tv/rotation";
import { liveVideoStatus } from "@/lib/tv/live";
import { config } from "@/lib/config";
import { fromStationTime, toStationTime } from "@/lib/schedule/time";
import type { TvKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<TvKind, string> = { MUSIC_VIDEO: "Music videos", CARTOON: "Cartoons", PROGRAM: "Shows", MOVIE: "Movies", COMMERCIAL: "Commercials" };
const noStore = { headers: { "Cache-Control": "no-store" } };

/**
 * What NCVR TV is showing right now:
 *  live feed → scheduled block (feature presentation, then episodes) → music-video rotation,
 *  with commercial breaks on a shared clock, plus the on-screen logo ("look").
 */
export async function GET() {
  const now = Date.now();
  let station: Awaited<ReturnType<typeof db.station.findUnique>> = null;
  try { station = await db.station.findUnique({ where: { slug: "ncvr" } }); } catch { /* handled below */ }

  const live = await liveVideoStatus();
  if (live.live && live.hlsUrl) {
    return NextResponse.json({ mode: "live", hlsUrl: live.hlsUrl, serverTime: now, look: resolveLook(station, null) }, noStore);
  }
  try {
    const tz = station?.timezone ?? config.timezone;
    const lt = toStationTime(new Date(now), tz);
    const today = `${lt.year}-${String(lt.month).padStart(2, "0")}-${String(lt.day).padStart(2, "0")}`;
    const blocks = await db.tvBlock.findMany({ where: { active: true } });
    let block = activeBlock(blocks, lt.isoDay, lt.minute);
    const select = { id: true, title: true, artistName: true, durationSec: true, advertiser: true };

    // Feature presentation inside the block (e.g. a 1-hour movie)
    if (block?.featureVideoId && block.featureStartMinute != null && (!block.featureDate || block.featureDate === today)) {
      const f = await db.musicVideo.findFirst({ where: { id: block.featureVideoId, status: "APPROVED" }, select });
      if (f) {
        const start = fromStationTime(lt.year, lt.month, lt.day, block.featureStartMinute, tz).getTime();
        const off = featureOffset(start, f.durationSec, now);
        if (off != null) {
          return NextResponse.json({
            mode: "rotation", serverTime: now, offsetSec: off, remainingSec: f.durationSec - off,
            item: { type: "video", feature: true, id: f.id, title: f.title, artist: f.artistName, src: `/api/tv/video/${f.id}`, durationSec: f.durationSec },
            next: [], block: { title: block.title, kind: block.kind, label: KIND_LABEL[block.kind] }, look: resolveLook(station, block),
          }, noStore);
        }
      }
    }

    const fetchKind = (kind: TvKind) => db.musicVideo.findMany({ where: { kind, status: "APPROVED" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select });
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
      breakEvery: block?.breakEvery ?? station?.tvBreakEvery ?? 3,
      breakSeconds: block?.breakSeconds ?? station?.tvBreakSeconds ?? 90,
    };
    const look = resolveLook(station, block);
    const blockInfo = block ? { title: block.title, kind: block.kind, label: KIND_LABEL[block.kind] } : null;
    const pos = channelNow(content, spots, cfg, now, origin);
    if (!pos) return NextResponse.json({ mode: "off", reason: "No videos are in rotation yet.", liveConfigured: live.configured, block: blockInfo, look });

    const base = { mode: "rotation", serverTime: now, offsetSec: pos.offsetSec, remainingSec: pos.remainingSec, block: blockInfo, liveConfigured: live.configured, look };
    if (pos.type === "video") {
      const v = content.find((x) => x.id === pos.videoId)!;
      return NextResponse.json({
        ...base,
        item: { type: "video", id: v.id, title: v.title, artist: v.artistName, src: `/api/tv/video/${v.id}`, durationSec: v.durationSec },
        next: upNext(content, pos.index, 3).map((x) => ({ title: x.title, artist: x.artistName })),
      }, noStore);
    }
    if (pos.type === "commercial") {
      const s = spots.find((x) => x.id === pos.spotId)!;
      return NextResponse.json({
        ...base, breakRemainingSec: pos.breakRemainingSec,
        item: { type: "commercial", id: s.id, title: s.title, advertiser: s.advertiser ?? s.artistName, src: `/api/tv/video/${s.id}`, durationSec: s.durationSec },
        next: [],
      }, noStore);
    }
    return NextResponse.json({ ...base, breakRemainingSec: pos.breakRemainingSec, item: { type: "card" }, next: [] }, noStore);
  } catch (e) {
    console.error("[tv/now]", e);
    return NextResponse.json({ mode: "off", reason: "NCVR TV is temporarily unavailable.", look: resolveLook(station, null) }, { status: 503 });
  }
}
