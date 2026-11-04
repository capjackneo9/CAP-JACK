/**
 * Vinyl-style scratch for the console decks.
 *
 * An AudioWorklet plays the decoded track from memory at any speed, forwards
 * or backwards, following a "platter position" driven by the jog wheel (or the
 * on-screen platter). The position is smoothed so jog ticks sound like a hand
 * moving a record rather than a series of clicks.
 */

/** Seconds of audio one jog tick moves in scratch mode (≈ a 33⅓ rpm record with a ~128-tick wheel). */
export const SCRATCH_SECONDS_PER_TICK = 1.8 / 128;
/** Seconds one jog tick moves in nudge mode (paused / playing). */
export const NUDGE_SECONDS_PER_TICK = { playing: 0.02, paused: 0.1 } as const;
/** Without a jog-touch control, scratch ends this long after the last jog tick. */
export const SCRATCH_RELEASE_MS = 160;

export function clampPosition(sec: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, sec);
  return Math.min(Math.max(0, sec), Math.max(0, duration - 0.05));
}

/** On-screen platter: pointer angle change (radians) → seconds of audio (one turn = 1.8 s at 33⅓ rpm). */
export function angleToSeconds(deltaRad: number): number {
  let d = deltaRad;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return (d / (2 * Math.PI)) * 1.8;
}

export const SCRATCH_WORKLET = `
class NcvrScratch extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null; this.len = 0; this.ratio = 1;
    this.pos = 0; this.target = 0; this.vel = 0;
    this.active = false; this.gain = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "load") { this.ch = m.channels; this.len = m.channels[0].length; this.ratio = m.sampleRate / sampleRate; this.active = false; this.gain = 0; }
      else if (m.type === "unload") { this.ch = null; this.len = 0; this.active = false; this.gain = 0; }
      else if (m.type === "start" && this.ch) { this.pos = this.target = m.pos * m.bufferRate; this.vel = 0; this.active = true; }
      else if (m.type === "target") { this.target = Math.min(Math.max(0, m.pos * m.bufferRate), this.len - 2); }
      else if (m.type === "stop") { this.active = false; }
    };
  }
  process(_in, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    if (!this.ch || (!this.active && this.gain <= 0)) { L.fill(0); if (R !== L) R.fill(0); return true; }
    const cl = this.ch[0], cr = this.ch[1] || this.ch[0];
    const reach = 0.015 * sampleRate, maxV = 8 * this.ratio;
    for (let i = 0; i < L.length; i++) {
      let want = (this.target - this.pos) / reach;
      if (want > maxV) want = maxV; else if (want < -maxV) want = -maxV;
      this.vel += (want - this.vel) * 0.004;
      this.pos += this.vel;
      if (this.pos < 0) { this.pos = 0; this.vel = 0; } else if (this.pos > this.len - 2) { this.pos = this.len - 2; this.vel = 0; }
      this.gain += ((this.active ? 1 : 0) - this.gain) * 0.01;
      const j = this.pos | 0, f = this.pos - j;
      L[i] = (cl[j] + (cl[j + 1] - cl[j]) * f) * this.gain;
      if (R !== L) R[i] = (cr[j] + (cr[j + 1] - cr[j]) * f) * this.gain;
    }
    if (!this.active && this.gain < 0.001) this.gain = 0;
    return true;
  }
}
registerProcessor("ncvr-scratch", NcvrScratch);
`;

/**
 * Jog-wheel noise guard. Worn or vibrating jog wheels (and some Party Mix units)
 * send stray single ticks; acting on them stutters a playing deck. A turn only
 * counts once it adds up to `minTicks` within `windowMs`.
 */
export const JOG_WINDOW_MS = 150;
export const JOG_MIN_TICKS = 3;
export function jogIsIntentional(recent: Array<{ t: number; d: number }>, now: number, minTicks = JOG_MIN_TICKS, windowMs = JOG_WINDOW_MS): boolean {
  let sum = 0;
  for (const r of recent) if (now - r.t <= windowMs) sum += Math.abs(r.d);
  return sum >= minTicks;
}

/** Pitch-fader noise guard: changes smaller than 0.1% are ignored; values are rounded to 0.05%. */
export function nextPitch(current: number, incoming: number): number {
  const q = Math.round(incoming * 2000) / 2000;
  return Math.abs(q - current) < 0.001 && q !== 0 ? current : q;
}
