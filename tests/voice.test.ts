import { describe, expect, it } from "vitest";
import { parseVoiceCommand, stripWakeWord } from "../src/lib/audio/voice";

const target = (s: string) => { const r = parseVoiceCommand(s); return r?.kind === "action" ? r.action.target : r?.kind ?? null; };

describe("voice commands", () => {
  it("needs the wake word", () => {
    expect(stripWakeWord("Console, play deck A")).toBe("play deck a");
    expect(stripWakeWord("hey console mic on")).toBe("mic on");
    expect(stripWakeWord("coming up next we play deck A")).toBeNull();
  });
  it("decks, including common mis-hearings", () => {
    expect(target("play deck A")).toBe("deckA.start");
    expect(target("play deck eh")).toBe("deckA.start");
    expect(target("pause deck bee")).toBe("deckB.stop");
    expect(target("deck two stop")).toBe("deckB.stop");
    expect(target("cue deck a")).toBe("deckA.cue");
    expect(target("deck B louder")).toBe("deckB.fader");
    expect(target("load next")).toBe("queue.next");
    expect(target("load the next track on deck b")).toBe("deckB.load");
  });
  it("crossfader, mic, pads, recording", () => {
    const xf = parseVoiceCommand("crossfade to deck B");
    expect(xf).toMatchObject({ action: { target: "crossfader", kind: "range", value: 1, force: true } });
    expect(parseVoiceCommand("center the crossfader")).toMatchObject({ action: { value: 0.5 } });
    expect(target("mic on")).toBe("mic.open");
    expect(target("turn off the microphone")).toBe("mic.close");
    expect(target("mute mic")).toBe("mic.muteOn");
    expect(target("unmute mic")).toBe("mic.muteOff");
    expect(target("play pad three")).toBe("pad3");
    expect(target("jingle 8")).toBe("pad8");
    expect(target("start recording")).toBe("record.start");
    expect(target("stop recording")).toBe("record.stop");
  });
  it("going live and ending always need confirmation", () => {
    expect(parseVoiceCommand("go live")).toMatchObject({ action: { target: "transmit.golive" }, confirm: true });
    expect(parseVoiceCommand("end broadcast")).toMatchObject({ action: { target: "transmit.end" }, confirm: true });
    expect(parseVoiceCommand("confirm")).toEqual({ kind: "confirm" });
    expect(parseVoiceCommand("cancel")).toEqual({ kind: "cancel" });
  });
  it("ignores things it doesn't understand", () => {
    expect(parseVoiceCommand("what a beautiful night")).toBeNull();
  });
});
