import { describe, expect, it } from "vitest";
import { interpret, learn, learnMismatch, parseMidi } from "../src/lib/audio/midi";
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
