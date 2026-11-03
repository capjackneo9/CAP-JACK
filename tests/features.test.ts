import { describe, expect, it } from "vitest";
import { rotationPosition, upNext, TV_EPOCH } from "@/lib/tv/rotation";
import { detectPdf, detectVideo, detectFileType } from "@/lib/files";
import { can, ROLES } from "@/lib/rbac";
import { presetDataSchema } from "@/lib/console/preset";

const vids = [{ id: "a", durationSec: 100 }, { id: "b", durationSec: 200 }, { id: "c", durationSec: 50 }];

describe("NCVR TV rotation clock", () => {
  it("returns null when nothing is in rotation", () => {
    expect(rotationPosition([], Date.now())).toBeNull();
    expect(rotationPosition([{ id: "x", durationSec: 0 }], Date.now())).toBeNull();
  });
  it("puts every viewer at the same video and offset", () => {
    expect(rotationPosition(vids, TV_EPOCH + 30_000)).toMatchObject({ videoId: "a", offsetSec: 30, remainingSec: 70 });
    expect(rotationPosition(vids, TV_EPOCH + 150_000)).toMatchObject({ videoId: "b", offsetSec: 50 });
    expect(rotationPosition(vids, TV_EPOCH + 320_000)).toMatchObject({ videoId: "c", offsetSec: 20 });
  });
  it("loops forever", () => {
    expect(rotationPosition(vids, TV_EPOCH + 350_000 * 1000 + 10_000)).toMatchObject({ videoId: "a", offsetSec: 10, cycleSec: 350 });
  });
  it("lists what's coming up, wrapping around", () => {
    expect(upNext(vids, 2, 2).map((v) => v.id)).toEqual(["a", "b"]);
  });
});

describe("video and résumé validation", () => {
  const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x20, ...new TextEncoder().encode("ftyp" + brand), 0, 0, 0, 0]);
  it("accepts MP4 and WebM video", () => {
    expect(detectVideo(ftyp("isom"))?.mime).toBe("video/mp4");
    expect(detectVideo(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("video/webm");
  });
  it("rejects audio-only MP4s and other files as video", () => {
    expect(detectVideo(ftyp("M4A "))).toBeNull();
    expect(detectVideo(new TextEncoder().encode("not a video at all"))).toBeNull();
  });
  it("accepts real PDFs only", () => {
    expect(detectPdf(new TextEncoder().encode("%PDF-1.7\n..."))?.mime).toBe("application/pdf");
    expect(detectPdf(new TextEncoder().encode("<html>resume</html>"))).toBeNull();
    expect(detectFileType(new TextEncoder().encode("%PDF-1.7 not audio"))).toBeNull();
  });
});

describe("new permissions", () => {
  it("only owners and station managers manage NCVR TV and review team applications", () => {
    for (const r of ROLES) {
      const mgr = r === "OWNER" || r === "STATION_MANAGER";
      expect(can(r, "video.manage")).toBe(mgr);
      expect(can(r, "interns.review")).toBe(mgr);
    }
  });
});

describe("console presets", () => {
  const good = {
    version: 1,
    decks: { A: { trim: 1, filter: 0, low: 0, mid: -3, high: 2, fader: 0.8, cue: false, trackId: "t1" } },
    master: { crossfade: 0.5, master: 0.9, monitor: 0.7 },
    mic: { gain: 1.2, ducking: true, duckLevel: 0.3, echo: 0, reverb: 0.2, monitor: false },
    pads: [{ source: "library", id: "x", name: "NCVR ID" }, null, { source: "pad", id: "y", name: "Airhorn" }],
    queue: ["t1", "t2"],
    transmit: { url: "wss://stream.nitecapviberadio.tech/webdj/ncvr/", user: "caprio", bitrate: 128000 },
  };
  it("accepts a full setup", () => {
    expect(presetDataSchema.safeParse(good).success).toBe(true);
  });
  it("never stores a DJ password", () => {
    const parsed = presetDataSchema.parse({ ...good, transmit: { ...good.transmit, password: "secret" } });
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });
  it("rejects out-of-range values", () => {
    expect(presetDataSchema.safeParse({ ...good, mic: { ...good.mic, gain: 99 } }).success).toBe(false);
    expect(presetDataSchema.safeParse({ ...good, pads: new Array(9).fill(null) }).success).toBe(false);
  });
});
