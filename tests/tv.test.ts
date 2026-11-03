import { describe, expect, it } from "vitest";
import { activeBlock, blocksOverlap, channelNow, fillBreak, validateBlock, TV_EPOCH } from "@/lib/tv/rotation";

const vids = [{ id: "v1", durationSec: 100 }, { id: "v2", durationSec: 100 }, { id: "v3", durationSec: 100 }, { id: "v4", durationSec: 100 }];
const spots = [{ id: "s30a", durationSec: 30, weight: 1 }, { id: "s30b", durationSec: 30, weight: 1 }, { id: "s15", durationSec: 15, weight: 1 }];
const cfg = { enabled: true, breakEvery: 2, breakSeconds: 90 };
const at = (sec: number) => TV_EPOCH + sec * 1000;

describe("commercial breaks", () => {
  it("fills a break without exceeding its length, no repeats, bumper for leftover", () => {
    const items = fillBreak(spots, 90, 42);
    const total = items.reduce((n, i) => n + i.durationSec, 0);
    expect(total).toBe(90);
    const ids = items.filter((i) => i.type === "commercial").map((i) => (i as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(3); // 30+30+15 = 75 → 15 s bumper
    expect(items[items.length - 1]).toMatchObject({ type: "card", durationSec: 15 });
  });

  it("is the same for every viewer (deterministic) but varies between breaks", () => {
    expect(fillBreak(spots, 60, 7)).toEqual(fillBreak(spots, 60, 7));
    const orders = new Set(Array.from({ length: 12 }, (_, s) => JSON.stringify(fillBreak(spots, 60, s).map((i) => i.type === "commercial" ? i.id : "card"))));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("places a break after every N videos", () => {
    expect(channelNow(vids, spots, cfg, at(150))).toMatchObject({ type: "video", videoId: "v2", offsetSec: 50 });
    const inBreak = channelNow(vids, spots, cfg, at(200));
    expect(inBreak?.type === "commercial" || inBreak?.type === "card").toBe(true);
    expect(channelNow(vids, spots, cfg, at(290))).toMatchObject({ type: "video", videoId: "v3", offsetSec: 0 });
    // cycle = 400 s of video + 2 breaks × 90 s = 580 s
    expect(channelNow(vids, spots, cfg, at(580 + 10))).toMatchObject({ type: "video", videoId: "v1", offsetSec: 10 });
  });

  it("skips breaks when disabled or when no commercials exist", () => {
    expect(channelNow(vids, spots, { ...cfg, enabled: false }, at(200))).toMatchObject({ type: "video", videoId: "v3" });
    expect(channelNow(vids, [], cfg, at(200))).toMatchObject({ type: "video", videoId: "v3" });
  });
});

describe("TV schedule blocks", () => {
  const sat = { id: "b1", title: "Saturday Morning Cartoons", days: [6], startMinute: 8 * 60, endMinute: 12 * 60, active: true };
  it("validates blocks", () => {
    expect(validateBlock(sat)).toBeNull();
    expect(validateBlock({ ...sat, days: [] })).toMatch(/day/);
    expect(validateBlock({ ...sat, endMinute: 7 * 60 })).toMatch(/after/);
  });
  it("detects overlaps on shared days only", () => {
    expect(blocksOverlap(sat, { ...sat, id: "b2", startMinute: 11 * 60, endMinute: 13 * 60 })).toBe(true);
    expect(blocksOverlap(sat, { ...sat, id: "b2", days: [7] })).toBe(false);
    expect(blocksOverlap(sat, { ...sat, id: "b2", startMinute: 12 * 60, endMinute: 13 * 60 })).toBe(false);
  });
  it("finds the block on air", () => {
    expect(activeBlock([sat], 6, 9 * 60)?.id).toBe("b1");
    expect(activeBlock([sat], 6, 12 * 60)).toBeNull();
    expect(activeBlock([sat], 5, 9 * 60)).toBeNull();
    expect(activeBlock([{ ...sat, active: false }], 6, 9 * 60)).toBeNull();
  });
});

describe("feature presentation & screen look", async () => {
  const { featureOffset, resolveLook } = await import("@/lib/tv/rotation");
  it("plays the feature only inside its window", () => {
    expect(featureOffset(1000, 3600, 1000 + 60_000)).toBe(60);
    expect(featureOffset(1000, 3600, 999)).toBeNull();
    expect(featureOffset(1000, 3600, 1000 + 3600_000)).toBeNull();
  });
  it("uses the block logo during a block, else the channel logo", () => {
    const st = { tvBugPath: null, tvBugPosition: "top-right", tvBugSize: "md", tvBugOpacity: 85 };
    expect(resolveLook(st, null)).toMatchObject({ bugSrc: "/brand/ncvr-tv-logo.webp", position: "top-right" });
    expect(resolveLook(st, { logoPath: "/brand/saturday-vibe-amerime.webp", logoPosition: "top-left", logoSize: "lg" }))
      .toMatchObject({ bugSrc: "/brand/saturday-vibe-amerime.webp", position: "top-left", size: "lg" });
    expect(resolveLook({ ...st, tvBugPosition: "middle" }, null).position).toBe("top-right"); // invalid → safe default
  });
  it("Amerime formats fit exactly in 2 hours", async () => {
    const { channelNow, TV_EPOCH } = await import("@/lib/tv/rotation");
    const eps15 = Array.from({ length: 15 }, (_, i) => ({ id: `e${i}`, durationSec: 420 }));
    const spot = [{ id: "ad", durationSec: 60, weight: 1 }];
    // 15 × 7 min + 15 × 1 min breaks = 120 min → loops back to episode 1 at exactly 2 h
    expect(channelNow(eps15, spot, { enabled: true, breakEvery: 1, breakSeconds: 60 }, TV_EPOCH + 120 * 60_000)).toMatchObject({ type: "video", videoId: "e0", offsetSec: 0 });
    const eps16 = Array.from({ length: 16 }, (_, i) => ({ id: `e${i}`, durationSec: 420 }));
    // 16 × 7 min + 8 × 1 min breaks (every 2 shows) = 120 min
    expect(channelNow(eps16, spot, { enabled: true, breakEvery: 2, breakSeconds: 60 }, TV_EPOCH + 120 * 60_000)).toMatchObject({ type: "video", videoId: "e0", offsetSec: 0 });
  });
});

describe("Saturday Vibe Amerime — 16 × 7-min shows, 2-min break every 4 shows", async () => {
  const { channelNow, fillBreak, TV_EPOCH } = await import("@/lib/tv/rotation");
  const eps = Array.from({ length: 16 }, (_, i) => ({ id: `ep${i + 1}`, durationSec: 420 }));
  const spots = Array.from({ length: 16 }, (_, i) => ({ id: `ad${i + 1}`, durationSec: 30, weight: 1 }));
  const cfg = { enabled: true, breakEvery: 4, breakSeconds: 120 };
  const at = (min: number) => TV_EPOCH + min * 60_000;
  it("follows the half-hour pattern", () => {
    expect(channelNow(eps, spots, cfg, at(0))).toMatchObject({ type: "video", videoId: "ep1" });
    expect(channelNow(eps, spots, cfg, at(27.5))).toMatchObject({ type: "video", videoId: "ep4" });
    expect(channelNow(eps, spots, cfg, at(28.25))?.type).toBe("commercial");   // 9:28 break
    expect(channelNow(eps, spots, cfg, at(30))).toMatchObject({ type: "video", videoId: "ep5", offsetSec: 0 }); // 9:30
    expect(channelNow(eps, spots, cfg, at(60))).toMatchObject({ type: "video", videoId: "ep9", offsetSec: 0 }); // 10:00
    expect(channelNow(eps, spots, cfg, at(90))).toMatchObject({ type: "video", videoId: "ep13", offsetSec: 0 }); // 10:30
    expect(channelNow(eps, spots, cfg, at(118.5))?.type).toBe("commercial");  // 10:58 final break
    expect(channelNow(eps, spots, cfg, at(120))).toMatchObject({ videoId: "ep1", offsetSec: 0 }); // exactly 2 hours
  });
  it("each 2-minute break is four different 30-second spots, no filler", () => {
    const items = fillBreak(spots, 120, 99);
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.type === "commercial" && i.durationSec === 30)).toBe(true);
    expect(new Set(items.map((i) => (i as { id: string }).id)).size).toBe(4);
  });
});
