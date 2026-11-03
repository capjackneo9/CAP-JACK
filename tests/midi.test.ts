import { describe, expect, it } from "vitest";
import { interpret, learn, parseMidi, scaleRange } from "@/lib/audio/midi";

describe("DJ controller (MIDI)", () => {
  it("parses notes, note-offs and CCs", () => {
    expect(parseMidi([0x90, 11, 127])).toMatchObject({ key: "n:1:11", type: "note", on: true });
    expect(parseMidi([0x90, 11, 0])).toMatchObject({ on: false });
    expect(parseMidi([0x81, 11, 0])).toMatchObject({ key: "n:2:11", on: false });
    expect(parseMidi([0xb0, 8, 100])).toMatchObject({ key: "c:1:8", type: "cc", value: 100 });
    expect(parseMidi([0xf8])).toBeNull(); // MIDI clock ignored
  });

  it("learns knobs only from CCs and buttons from presses", () => {
    let m = learn({}, parseMidi([0x90, 1, 127])!, "crossfader");
    expect(m).toEqual({}); // a button can't drive the crossfader
    m = learn(m, parseMidi([0xb0, 8, 64])!, "crossfader");
    expect(m).toEqual({ "c:1:8": "crossfader" });
    m = learn(m, parseMidi([0x90, 11, 127])!, "deckA.play");
    expect(m["n:1:11"]).toBe("deckA.play");
    // re-learning a target moves it to the new control
    m = learn(m, parseMidi([0xb0, 9, 0])!, "crossfader");
    expect(m["c:1:8"]).toBeUndefined();
    expect(m["c:1:9"]).toBe("crossfader");
  });

  it("turns controller input into console actions", () => {
    const m = { "c:1:8": "crossfader", "n:1:11": "deckA.play", "c:1:6": "deckA.jog", "c:1:22": "deckB.low" };
    expect(interpret(parseMidi([0xb0, 8, 127])!, m)).toEqual({ target: "crossfader", kind: "range", value: 1 });
    expect(interpret(parseMidi([0x90, 11, 127])!, m)).toEqual({ target: "deckA.play", kind: "button" });
    expect(interpret(parseMidi([0x90, 11, 0])!, m)).toBeNull(); // release does nothing
    expect(interpret(parseMidi([0xb0, 6, 1])!, m)).toEqual({ target: "deckA.jog", kind: "jog", delta: 1 });
    expect(interpret(parseMidi([0xb0, 6, 127])!, m)).toEqual({ target: "deckA.jog", kind: "jog", delta: -1 });
    expect(interpret(parseMidi([0xb0, 99, 1])!, m)).toBeNull(); // unmapped
  });

  it("keeps 12 o'clock neutral on centered knobs", () => {
    expect(scaleRange("deckA.low", 0.5)).toBe(0);
    expect(scaleRange("deckA.low", 0)).toBe(-24);
    expect(scaleRange("deckA.high", 1)).toBe(12);
    expect(scaleRange("deckB.filter", 0.5)).toBe(0);
    expect(scaleRange("deckB.trim", 0.5)).toBe(1);
    expect(scaleRange("crossfader", 0.25)).toBe(0.25);
  });
});
