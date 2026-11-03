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
