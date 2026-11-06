/**
 * Voice commands for the broadcast console. Pure parsing — the console's
 * VoicePanel does the listening (browser speech recognition) and sends the
 * resulting actions over the same control bus the DJ controller uses.
 */
import type { ControlAction } from "./midi";

export const WAKE_WORD = "console";

export type VoiceResult =
  | { kind: "action"; action: ControlAction; say: string; confirm?: boolean }
  | { kind: "confirm" }
  | { kind: "cancel" }
  | { kind: "help" };

/** What the DJ can say (shown in the console). */
export const VOICE_HELP: Array<[string, string]> = [
  ["play deck A  /  pause deck B", "Start or pause a deck"],
  ["cue deck A", "Back to the start of the track"],
  ["load next  /  load next on deck B", "Next queued track to a free deck / that deck"],
  ["deck A louder  /  deck B quieter", "Channel volume up or down"],
  ["crossfade to deck B  /  center the crossfader", "Move the crossfader"],
  ["mic on  /  mic off  /  mute mic  /  unmute mic", "Microphone"],
  ["play pad 3", "Fire a pad (1–8)"],
  ["start recording  /  stop recording", "Record the program"],
  ["go live  →  confirm", "Start broadcasting (asks you to say “confirm”)"],
  ["end broadcast  →  confirm", "Hand back to AutoDJ (asks you to say “confirm”)"],
  ["cancel", "Forget a command waiting for “confirm”"],
];

const NUM: Record<string, string> = { one: "1", won: "1", two: "2", to: "2", too: "2", three: "3", tree: "3", four: "4", for: "4", five: "5", six: "6", seven: "7", eight: "8", ate: "8" };

/** Lower-case, strip punctuation and even out common mis-hearings ("deck eh" → "deck a"). */
export function normalize(text: string): string {
  let t = ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  t = t.replace(/ (?:deck|dec|dek|tech|check|doc) (?:a|eh|hey|ay|8|one|1|left) /g, " deck a ")
    .replace(/ (?:deck|dec|dek|tech|check|doc) (?:b|be|bee|bea|two|2|to|too|right) /g, " deck b ")
    .replace(/ left deck /g, " deck a ").replace(/ right deck /g, " deck b ")
    .replace(/ (?:microphone|mike|might) /g, " mic ")
    .replace(/ (pad|jingle|drop|sound|sample) (\w+) /g, (_m, w: string, n: string) => ` pad ${NUM[n] ?? n} `)
    .replace(/ centre /g, " center ");
  return t.replace(/\s+/g, " ").trim();
}

/** Remove the wake word ("console, play deck A"). Returns null if it isn't there. */
export function stripWakeWord(text: string, wake = WAKE_WORD): string | null {
  const t = normalize(text);
  const m = t.match(new RegExp(`^(?:hey |ok |okay )?(?:${wake}|consul|consoles|council)\\b\\s*(.*)$`));
  return m ? m[1] : null;
}

const deckOf = (t: string): "A" | "B" | null => (/\bdeck a\b/.test(t) ? "A" : /\bdeck b\b/.test(t) ? "B" : null);
const btn = (target: string, say: string, confirm = false): VoiceResult => ({ kind: "action", action: { target, kind: "button" }, say, confirm });

/** Turn one spoken phrase (already normalized, wake word removed) into a console action. */
export function parseVoiceCommand(raw: string): VoiceResult | null {
  const t = normalize(raw);
  if (!t) return null;
  if (/^(help|what can i say|commands|voice commands)$/.test(t)) return { kind: "help" };
  if (/^(yes )?(confirm|confirmed|confirm it|do it)$/.test(t)) return { kind: "confirm" };
  if (/^(cancel|no|never ?mind|forget it|abort)$/.test(t)) return { kind: "cancel" };

  if (/\b(go|going|take me|put me) (live|on air)\b/.test(t)) return btn("transmit.golive", "Go live", true);
  if (/\b(end|stop|finish) (the )?(broadcast|show|stream|live)\b|\bgo off air\b|\boff air\b|\bback to auto ?dj\b/.test(t)) return btn("transmit.end", "End broadcast → AutoDJ", true);

  if (/\b(start|begin) (the )?recording\b|^record( the)?( show| program)?$/.test(t)) return btn("record.start", "Start recording");
  if (/\b(stop|end) (the )?recording\b/.test(t)) return btn("record.stop", "Stop recording");

  if (/\bunmute\b/.test(t)) return btn("mic.muteOff", "Unmute mic");
  if (/\bmute (the )?mic\b|\bmic mute\b/.test(t)) return btn("mic.muteOn", "Mute mic");
  if (/\bmic (on|open|live)\b|\b(open|turn on) (the |my )?mic\b/.test(t)) return btn("mic.open", "Mic on");
  if (/\bmic (off|close|closed)\b|\b(close|turn off|kill) (the |my )?mic\b/.test(t)) return btn("mic.close", "Mic off");

  const pad = t.match(/\bpad ([1-8])\b/);
  if (pad) return btn(`pad${pad[1]}`, `Pad ${pad[1]}`);

  const d = deckOf(t);
  if (/\bload (the )?next\b/.test(t)) return d ? btn(`deck${d}.load`, `Load next on deck ${d}`) : btn("queue.next", "Load next to a free deck");

  if (/\b(cross ?fade|cross ?fader|fade over|x ?fade)\b|\bfader\b/.test(t)) {
    if (/\bcenter|middle|half\b/.test(t)) return { kind: "action", action: { target: "crossfader", kind: "range", value: 0.5, force: true }, say: "Crossfader to center" };
    if (d) return { kind: "action", action: { target: "crossfader", kind: "range", value: d === "A" ? 0 : 1, force: true }, say: `Crossfade to deck ${d}` };
  }

  if (d) {
    if (/\b(louder|volume up|turn (it )?up|up)\b/.test(t)) return { kind: "action", action: { target: `deck${d}.fader`, kind: "adjust", delta: 0.1 }, say: `Deck ${d} louder` };
    if (/\b(quieter|softer|volume down|turn (it )?down|down)\b/.test(t)) return { kind: "action", action: { target: `deck${d}.fader`, kind: "adjust", delta: -0.1 }, say: `Deck ${d} quieter` };
    if (/\b(cue|restart|rewind|back to (the )?(start|top|beginning))\b/.test(t)) return btn(`deck${d}.cue`, `Cue deck ${d} to start`);
    if (/\b(pause|stop|hold)\b/.test(t)) return btn(`deck${d}.stop`, `Pause deck ${d}`);
    if (/\b(play|start|go|drop|spin|run)\b/.test(t)) return btn(`deck${d}.start`, `Play deck ${d}`);
  }
  if (/\b(master|station|main) volume (up|louder)\b|\bmaster up\b/.test(t)) return { kind: "action", action: { target: "master", kind: "adjust", delta: 0.1 }, say: "Master louder" };
  if (/\b(master|station|main) volume (down|quieter)\b|\bmaster down\b/.test(t)) return { kind: "action", action: { target: "master", kind: "adjust", delta: -0.1 }, say: "Master quieter" };
  return null;
}

/** The station's primary microphone (the Universal Audio Volt interface), when it is plugged in. */
export function findPrimaryMic<T extends { kind: string; deviceId: string; label: string }>(devices: T[]): T | undefined {
  return devices.find((d) => d.kind === "audioinput" && d.deviceId !== "default" && d.deviceId !== "communications" && /\bvolt\b/i.test(d.label));
}
