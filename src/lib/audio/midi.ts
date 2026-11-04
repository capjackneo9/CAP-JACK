/**
 * DJ-controller (MIDI) support for the broadcast console. Pure helpers —
 * the Web MIDI wiring lives in the console's MidiPanel.
 *
 * Mapping is learned ("MIDI Learn"): the DJ clicks a console control, then
 * moves the matching knob/button. Works with any class-compliant controller
 * (e.g. Numark Party Mix / Party Mix II / Party Mix Live).
 */
export type TargetKind = "range" | "button" | "jog" | "touch";
export interface ControlTarget { id: string; label: string; group: string; kind: TargetKind }

const deckTargets = (d: "A" | "B"): ControlTarget[] => [
  { id: `deck${d}.play`, label: "Play / pause", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.cue`, label: "Cue (back to start)", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.pfl`, label: "Headphone cue (PFL)", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.jog`, label: "Jog wheel (turn)", group: `Deck ${d}`, kind: "jog" },
  { id: `deck${d}.touch`, label: "Jog wheel top (touch = scratch)", group: `Deck ${d}`, kind: "touch" },
  { id: `deck${d}.scratchMode`, label: "Scratch on / off", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.fader`, label: "Channel volume", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.pitch`, label: "Pitch / tempo fader (±8%)", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.trim`, label: "Gain / trim", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.high`, label: "EQ high", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.mid`, label: "EQ mid", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.low`, label: "EQ low / bass", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.filter`, label: "Filter", group: `Deck ${d}`, kind: "range" },
  { id: `deck${d}.load`, label: "Load next queued track", group: `Deck ${d}`, kind: "button" },
];

export const CONTROL_TARGETS: ControlTarget[] = [
  { id: "crossfader", label: "Crossfader", group: "Mixer", kind: "range" },
  { id: "master", label: "Master volume (transmitted)", group: "Mixer", kind: "range" },
  { id: "cue.volume", label: "Headphone volume", group: "Mixer", kind: "range" },
  ...deckTargets("A"),
  ...deckTargets("B"),
  { id: "mic.toggle", label: "Mic on / off", group: "Microphone", kind: "button" },
  { id: "mic.mute", label: "Mic mute", group: "Microphone", kind: "button" },
  { id: "mic.gain", label: "Mic gain", group: "Microphone", kind: "range" },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `pad${i + 1}`, label: `Pad ${i + 1}`, group: "Pads / IDs / FX", kind: "button" as const })),
];

export const TARGET_BY_ID = new Map(CONTROL_TARGETS.map((t) => [t.id, t]));

/** Key identifying one physical control: note or CC, MIDI channel, number. */
export type MidiKey = string; // e.g. "n:1:11" (note 11 on ch.1) or "c:1:8" (CC 8 on ch.1)

export interface MidiMessage { key: MidiKey; type: "note" | "cc" | "pb"; on: boolean; value: number }

/**
 * Parse note on/off, control change and pitch bend (some controllers send their
 * pitch faders as 14-bit pitch bend). Pitch bend is reduced to 0..127.
 */
export function parseMidi(data: ArrayLike<number>): MidiMessage | null {
  if (!data || data.length < 3) return null;
  if ((data[0] & 0xf0) === 0xe0) {
    const v14 = (data[2] << 7) | data[1];
    return { key: `p:${(data[0] & 0x0f) + 1}:0`, type: "pb", on: true, value: Math.round((v14 / 16383) * 127) };
  }
  const status = data[0] & 0xf0;
  const ch = (data[0] & 0x0f) + 1;
  const num = data[1];
  const val = data[2];
  if (status === 0x90) return { key: `n:${ch}:${num}`, type: "note", on: val > 0, value: val };
  if (status === 0x80) return { key: `n:${ch}:${num}`, type: "note", on: false, value: 0 };
  if (status === 0xb0) return { key: `c:${ch}:${num}`, type: "cc", on: val >= 64, value: val };
  return null;
}

export type ControlAction =
  | { target: string; kind: "range"; value: number }  // 0..1
  | { target: string; kind: "button" }                // a press
  | { target: string; kind: "jog"; delta: number }    // signed ticks
  | { target: string; kind: "touch"; down: boolean }; // jog-wheel top touched / released

/** Turn a MIDI message into a console action using the learned mapping. */
export function interpret(msg: MidiMessage, mapping: Record<MidiKey, string>): ControlAction | null {
  const target = mapping[msg.key];
  const t = target ? TARGET_BY_ID.get(target) : undefined;
  if (!t) return null;
  if (t.kind === "range") return msg.type !== "note" ? { target: t.id, kind: "range", value: msg.value / 127 } : null;
  if (t.kind === "button") return msg.on ? { target: t.id, kind: "button" } : null;
  if (t.kind === "touch") return { target: t.id, kind: "touch", down: msg.on };
  // jog: relative CC (1..63 forward, 65..127 backward)
  if (msg.type !== "cc" || msg.value === 64 || msg.value === 0) return null;
  return { target: t.id, kind: "jog", delta: msg.value < 64 ? msg.value : msg.value - 128 };
}

/** Why a message could not be learned for a target (shown while listening), or null if it fits. */
export function learnMismatch(msg: MidiMessage, target: string): string | null {
  const t = TARGET_BY_ID.get(target);
  if (!t) return "Unknown control";
  if (msg.type === "note" && !msg.on) return null; // button release — ignored quietly
  if ((t.kind === "range" || t.kind === "jog") && msg.type === "note")
    return t.kind === "jog"
      ? "That was the wheel's touch-sensitive top (a button message). Turn the jog wheel by its outer edge instead — or map it to “Jog wheel top (touch = scratch)”."
      : "That control sent a button message. Turn the knob or slide the fader instead.";
  if (t.kind === "jog" && msg.type === "pb") return "That was a pitch fader. Turn the jog wheel instead.";
  if (t.kind === "touch" && msg.type !== "note") return "That was a knob/wheel turn. Rest your hand on top of the jog wheel without turning it.";
  return null;
}

/** Learn: assign the incoming control to a target (one control per target). */
export function learn(mapping: Record<MidiKey, string>, msg: MidiMessage, target: string): Record<MidiKey, string> {
  const t = TARGET_BY_ID.get(target);
  if (!t) return mapping;
  if (msg.type === "note" && !msg.on) return mapping;
  if (learnMismatch(msg, target)) return mapping;
  const next = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v !== target));
  next[msg.key] = target;
  return next;
}

/** Scale a 0..1 controller value to a console parameter. Centered knobs keep 12 o'clock = neutral. */
export function scaleRange(target: string, v: number): number {
  const p = target.split(".").pop();
  if (p === "low" || p === "mid" || p === "high") return v < 0.5 ? -24 + v * 48 : (v - 0.5) * 24; // -24..0..+12 dB
  if (p === "filter") return v * 2 - 1;      // -1..1 (center = off)
  if (p === "pitch") {                       // playback-rate offset -0.08..+0.08, with a centre dead zone
    const x = v * 2 - 1;
    return Math.abs(x) < 0.02 ? 0 : x * 0.08;
  }
  if (p === "trim") return v * 2;            // 0..2 (center = unity)
  if (target === "master") return v * 1.2;
  if (target === "mic.gain") return v * 3;
  if (target === "cue.volume") return v * 1.5;
  return v;                                  // faders, crossfader: 0..1
}

export function describeKey(key: MidiKey): string {
  const [t, ch, n] = key.split(":");
  if (t === "p") return `Pitch bend · ch ${ch}`;
  return `${t === "n" ? "Button/note" : "Knob/CC"} ${n} · ch ${ch}`;
}

/**
 * Ready-made controller maps. Control numbers come from the Mixxx project's
 * community mapping for the Numark Party Mix (res/controllers/Numark-Party-Mix.midi.xml):
 * decks on MIDI channels 1/2, pads on channels 5/6, crossfader/master/load on channel 16.
 */
export interface ControllerProfile { id: string; name: string; match: RegExp; mapping: Record<MidiKey, string>; notes: string }

const partyMixDeck = (d: "A" | "B", ch: number, padBase: number): Record<MidiKey, string> => ({
  [`n:${ch}:0`]: `deck${d}.play`,
  [`n:${ch}:1`]: `deck${d}.cue`,
  [`n:${ch}:7`]: `deck${d}.scratchMode`,
  [`n:${ch}:27`]: `deck${d}.pfl`,
  [`c:${ch}:6`]: `deck${d}.jog`,
  [`c:${ch}:9`]: `deck${d}.pitch`,
  [`c:${ch}:23`]: `deck${d}.trim`,
  [`c:${ch}:24`]: `deck${d}.high`,
  [`c:${ch}:25`]: `deck${d}.low`,
  [`c:${ch}:28`]: `deck${d}.fader`,
  [`n:${ch + 4}:20`]: `pad${padBase + 1}`,
  [`n:${ch + 4}:21`]: `pad${padBase + 2}`,
  [`n:${ch + 4}:22`]: `pad${padBase + 3}`,
  [`n:${ch + 4}:23`]: `pad${padBase + 4}`,
});

export const CONTROLLER_PROFILES: ControllerProfile[] = [
  {
    id: "numark-party-mix",
    name: "Numark Party Mix / Party Mix II",
    match: /party\s*mix/i,
    mapping: {
      "c:16:8": "crossfader",
      "c:16:10": "master",
      "c:16:12": "cue.volume",
      "n:16:2": "deckA.load",
      "n:16:3": "deckB.load",
      ...partyMixDeck("A", 1, 0),
      ...partyMixDeck("B", 2, 4),
    },
    notes: "Left pads → console pads 1–4, right pads → pads 5–8. Sync, browse and the pad-mode buttons have no console function. Test each control: if any doesn't respond (the Party Mix II can differ from the original), open Map controls → Guided setup.",
  },
];

/** The ready-made profile for a connected device name, if there is one. */
export function profileForDevice(name: string): ControllerProfile | undefined {
  return CONTROLLER_PROFILES.find((p) => p.match.test(name));
}

/** Guided setup: one prompt per physical control, in the order they sit on a Party Mix / Party Mix II. */
export interface GuideStep { target: string; prompt: string }
const guideDeck = (d: "A" | "B", side: string, padBase: number): GuideStep[] => [
  { target: `deck${d}.play`, prompt: `Press the ${side} deck PLAY button` },
  { target: `deck${d}.cue`, prompt: `Press the ${side} deck CUE button` },
  { target: `deck${d}.pfl`, prompt: `Press the ${side} headphone (PFL) button` },
  { target: `deck${d}.jog`, prompt: `Turn the ${side} jog wheel` },
  { target: `deck${d}.scratchMode`, prompt: `Press the ${side} SCRATCH button (Skip if there isn't one)` },
  { target: `deck${d}.fader`, prompt: `Move the ${side} volume fader` },
  { target: `deck${d}.pitch`, prompt: `Move the ${side} pitch fader` },
  { target: `deck${d}.trim`, prompt: `Turn the ${side} GAIN knob` },
  { target: `deck${d}.high`, prompt: `Turn the ${side} TREBLE knob` },
  { target: `deck${d}.low`, prompt: `Turn the ${side} BASS knob` },
  { target: `deck${d}.load`, prompt: `Press the ${side} LOAD button` },
  ...[1, 2, 3, 4].map((n) => ({ target: `pad${padBase + n}`, prompt: `Tap ${side} pad ${n}` })),
];
export const PARTY_MIX_GUIDE: GuideStep[] = [
  { target: "crossfader", prompt: "Slide the CROSSFADER" },
  { target: "master", prompt: "Turn the MASTER volume knob" },
  { target: "cue.volume", prompt: "Turn the HEADPHONE (cue) volume knob" },
  ...guideDeck("A", "LEFT", 0),
  ...guideDeck("B", "RIGHT", 4),
];
