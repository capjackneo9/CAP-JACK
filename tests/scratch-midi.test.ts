import { describe, expect, it } from "vitest";
import { CONTROLLER_PROFILES, TARGET_BY_ID, interpret, learn, learnMismatch, parseMidi, profileForDevice, scaleRange } from "../src/lib/audio/midi";
import { angleToSeconds, clampPosition } from "../src/lib/audio/scratch";

describe("MIDI learn — jog touch, pitch bend, feedback", () => {
  it("learns the jog-wheel top as a touch control and reports press/release", () => {
    const press = parseMidi([0x90, 0x06, 0x7f])!;
    const m = learn({}, press, "deckA.touch");
    expect(m).toEqual({ "n:1:6": "deckA.touch" });
    expect(interpret(press, m)).toEqual({ target: "deckA.touch", kind: "touch", down: true });
    expect(interpret(parseMidi([0x80, 0x06, 0x00])!, m)).toEqual({ target: "deckA.touch", kind: "touch", down: false });
  });

  it("explains why the wheel's touch note can't be learned as the jog turn", () => {
    const touch = parseMidi([0x90, 0x06, 0x7f])!;
    expect(learnMismatch(touch, "deckA.jog")).toMatch(/outer edge/);
    expect(learn({}, touch, "deckA.jog")).toEqual({});
    const turn = parseMidi([0xb0, 0x06, 0x01])!;
    expect(learnMismatch(turn, "deckA.jog")).toBeNull();
    expect(learn({}, turn, "deckA.jog")).toEqual({ "c:1:6": "deckA.jog" });
  });

  it("parses pitch bend and allows it for faders", () => {
    const pb = parseMidi([0xe1, 0x7f, 0x7f])!;
    expect(pb).toMatchObject({ key: "p:2:0", type: "pb", value: 127 });
    const m = learn({}, pb, "deckB.fader");
    expect(interpret(pb, m)).toEqual({ target: "deckB.fader", kind: "range", value: 1 });
    expect(learnMismatch(pb, "deckB.jog")).toMatch(/pitch fader/);
  });

  it("ignores button releases while learning (no error shown)", () => {
    expect(learnMismatch(parseMidi([0x80, 0x10, 0])!, "deckA.fader")).toBeNull();
    expect(learn({}, parseMidi([0x80, 0x10, 0])!, "deckA.play")).toEqual({});
  });
});

describe("scratch helpers", () => {
  it("maps a full platter turn to 1.8 s (33⅓ rpm) and wraps across ±π", () => {
    expect(angleToSeconds(Math.PI / 2)).toBeCloseTo(0.45);
    expect(angleToSeconds(-Math.PI / 2)).toBeCloseTo(-0.45);
    // crossing the ±π seam is a small move, not a whole turn
    expect(angleToSeconds(2 * Math.PI - 0.1)).toBeCloseTo((-0.1 / (2 * Math.PI)) * 1.8);
  });
  it("keeps the record inside the track", () => {
    expect(clampPosition(-3, 100)).toBe(0);
    expect(clampPosition(200, 100)).toBeCloseTo(99.95);
    expect(clampPosition(5, NaN)).toBe(5);
  });
});

describe("Numark Party Mix ready-made map", () => {
  const pm = CONTROLLER_PROFILES.find((p) => p.id === "numark-party-mix")!;
  const run = (bytes: number[]) => interpret(parseMidi(bytes)!, pm.mapping);

  it("is picked for the device name Windows/Mac report", () => {
    expect(profileForDevice("Numark Party Mix")?.id).toBe("numark-party-mix");
    expect(profileForDevice("Party Mix II")?.id).toBe("numark-party-mix");
    expect(profileForDevice("DDJ-200")).toBeUndefined();
  });
  it("only maps to real console controls", () => {
    for (const t of Object.values(pm.mapping)) expect(TARGET_BY_ID.has(t)).toBe(true);
  });
  it("drives decks, jog, crossfader, load and pads", () => {
    expect(run([0x90, 0x00, 0x7f])).toEqual({ target: "deckA.play", kind: "button" });
    expect(run([0x91, 0x01, 0x7f])).toEqual({ target: "deckB.cue", kind: "button" });
    expect(run([0xb0, 0x06, 0x7f])).toEqual({ target: "deckA.jog", kind: "jog", delta: -1 });
    expect(run([0xb1, 0x06, 0x03])).toEqual({ target: "deckB.jog", kind: "jog", delta: 3 });
    expect(run([0xbf, 0x08, 0x7f])).toEqual({ target: "crossfader", kind: "range", value: 1 });
    expect(run([0x9f, 0x03, 0x7f])).toEqual({ target: "deckB.load", kind: "button" });
    expect(run([0x94, 0x14, 0x7f])).toEqual({ target: "pad1", kind: "button" });
    expect(run([0x95, 0x17, 0x7f])).toEqual({ target: "pad8", kind: "button" });
    expect(run([0x90, 0x07, 0x7f])).toEqual({ target: "deckA.scratchMode", kind: "button" });
  });
  it("pitch fader: centre is exactly 0, ends are ±8%", () => {
    expect(scaleRange("deckA.pitch", 64 / 127)).toBe(0);
    expect(scaleRange("deckA.pitch", 1)).toBeCloseTo(0.08);
    expect(scaleRange("deckA.pitch", 0)).toBeCloseTo(-0.08);
  });
});

describe("controller noise guards", () => {
  it("ignores stray single jog ticks but accepts a real turn", async () => {
    const { jogIsIntentional } = await import("../src/lib/audio/scratch");
    expect(jogIsIntentional([{ t: 1000, d: 1 }], 1000)).toBe(false);
    expect(jogIsIntentional([{ t: 700, d: 1 }, { t: 1000, d: -1 }], 1000)).toBe(false);
    expect(jogIsIntentional([{ t: 950, d: 1 }, { t: 980, d: 1 }, { t: 1000, d: 2 }], 1000)).toBe(true);
  });
  it("ignores pitch-fader flicker", async () => {
    const { nextPitch } = await import("../src/lib/audio/scratch");
    expect(nextPitch(0.02, 0.0204)).toBe(0.02);
    expect(nextPitch(0.02, 0.03)).toBe(0.03);
    expect(nextPitch(0.02, 0)).toBe(0);
  });
});
