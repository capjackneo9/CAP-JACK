/**
 * DJ-controller (MIDI) support for the broadcast console. Pure helpers —
 * the Web MIDI wiring lives in the console's MidiPanel.
 *
 * Mapping is learned ("MIDI Learn"): the DJ clicks a console control, then
 * moves the matching knob/button. Works with any class-compliant controller
 * (e.g. Numark Party Mix / Party Mix II / Party Mix Live).
 */
export type TargetKind = "range" | "button" | "jog";
export interface ControlTarget { id: string; label: string; group: string; kind: TargetKind }

const deckTargets = (d: "A" | "B"): ControlTarget[] => [
  { id: `deck${d}.play`, label: "Play / pause", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.cue`, label: "Cue (back to start)", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.pfl`, label: "Headphone cue (PFL)", group: `Deck ${d}`, kind: "button" },
  { id: `deck${d}.jog`, label: "Jog wheel (nudge / scrub)", group: `Deck ${d}`, kind: "jog" },
  { id: `deck${d}.fader`, label: "Channel volume", group: `Deck ${d}`, kind: "range" },
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

export interface MidiMessage { key: MidiKey; type: "note" | "cc"; on: boolean; value: number }

export function parseMidi(data: ArrayLike<number>): MidiMessage | null {
  if (!data || data.length < 3) return null;
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
  | { target: string; kind: "jog"; delta: number };   // signed ticks

/** Turn a MIDI message into a console action using the learned mapping. */
export function interpret(msg: MidiMessage, mapping: Record<MidiKey, string>): ControlAction | null {
  const target = mapping[msg.key];
  const t = target ? TARGET_BY_ID.get(target) : undefined;
  if (!t) return null;
  if (t.kind === "range") return msg.type === "cc" ? { target: t.id, kind: "range", value: msg.value / 127 } : null;
  if (t.kind === "button") return msg.on ? { target: t.id, kind: "button" } : null;
  // jog: relative CC (1..63 forward, 65..127 backward); notes (touch) are ignored
  if (msg.type !== "cc" || msg.value === 64 || msg.value === 0) return null;
  return { target: t.id, kind: "jog", delta: msg.value < 64 ? msg.value : msg.value - 128 };
}

/** Learn: assign the incoming control to a target (one control per target). */
export function learn(mapping: Record<MidiKey, string>, msg: MidiMessage, target: string): Record<MidiKey, string> {
  const t = TARGET_BY_ID.get(target);
  if (!t) return mapping;
  if (t.kind !== "button" && msg.type !== "cc") return mapping; // knobs/faders/jogs must be CCs
  if (msg.type === "note" && !msg.on) return mapping;
  const next = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v !== target));
  next[msg.key] = target;
  return next;
}

/** Scale a 0..1 controller value to a console parameter. Centered knobs keep 12 o'clock = neutral. */
export function scaleRange(target: string, v: number): number {
  const p = target.split(".").pop();
  if (p === "low" || p === "mid" || p === "high") return v < 0.5 ? -24 + v * 48 : (v - 0.5) * 24; // -24..0..+12 dB
  if (p === "filter") return v * 2 - 1;      // -1..1 (center = off)
  if (p === "trim") return v * 2;            // 0..2 (center = unity)
  if (target === "master") return v * 1.2;
  if (target === "mic.gain") return v * 3;
  return v;                                  // faders, crossfader: 0..1
}

export function describeKey(key: MidiKey): string {
  const [t, ch, n] = key.split(":");
  return `${t === "n" ? "Button/note" : "Knob/CC"} ${n} · ch ${ch}`;
}
