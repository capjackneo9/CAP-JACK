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

/**
 * Deck voice (AudioWorklet). Once a track is decoded the deck plays it from
 * memory here — sample-accurate and immune to network/disk hiccups — and the
 * same voice scratches. Modes: "stop", "play" (normal speed × rate) and
 * "scratch" (follows a platter position). Positions in messages are seconds.
 * Reports {type:"pos", pos, t, seq} ~20×/s and {type:"ended", seq}.
 */
export const SCRATCH_WORKLET = `
class NcvrDeck extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null; this.len = 0; this.bufRate = 44100; this.ratio = 1;
    this.mode = "stop"; this.pos = 0; this.target = 0; this.vel = 0; this.rate = 1;
    this.gain = 0; this.seq = 0; this.blocks = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (typeof m.seq === "number") this.seq = m.seq;
      const at = (sec) => Math.min(Math.max(0, sec * this.bufRate), Math.max(0, this.len - 2));
      switch (m.type) {
        case "load": this.ch = m.channels; this.len = m.channels[0].length; this.bufRate = m.sampleRate; this.ratio = m.sampleRate / sampleRate; this.mode = "stop"; this.pos = 0; this.vel = 0; this.gain = 0; break;
        case "unload": this.ch = null; this.len = 0; this.mode = "stop"; this.gain = 0; break;
        case "play": if (this.ch) { this.pos = this.target = at(m.pos); this.rate = m.rate; this.vel = this.ratio * m.rate; this.mode = "play"; } break;
        case "pause": this.mode = "stop"; break;
        case "seek": this.pos = this.target = at(m.pos); break;
        case "rate": this.rate = m.rate; break;
        case "scratchStart": if (this.ch) { this.target = this.pos; this.mode = "scratch"; } break;
        case "target": this.target = at(m.pos); break;
        case "scratchEnd": this.mode = m.resume ? "play" : "stop"; break;
      }
    };
  }
  process(_in, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    if (!this.ch || (this.mode === "stop" && this.gain <= 0)) { L.fill(0); if (R !== L) R.fill(0); return true; }
    const cl = this.ch[0], cr = this.ch[1] || this.ch[0];
    const reach = 0.015 * sampleRate, maxV = 8 * this.ratio, end = this.len - 2;
    for (let i = 0; i < L.length; i++) {
      if (this.mode === "play") {
        this.vel += (this.ratio * this.rate - this.vel) * 0.01;
      } else if (this.mode === "scratch") {
        let want = (this.target - this.pos) / reach;
        if (want > maxV) want = maxV; else if (want < -maxV) want = -maxV;
        this.vel += (want - this.vel) * 0.004;
      }
      if (this.mode !== "stop") this.pos += this.vel;
      if (this.pos < 0) { this.pos = 0; this.vel = 0; }
      else if (this.pos > end) {
        this.pos = end; this.vel = 0;
        if (this.mode === "play") { this.mode = "stop"; this.port.postMessage({ type: "ended", seq: this.seq }); }
      }
      this.gain += ((this.mode === "stop" ? 0 : 1) - this.gain) * 0.02;
      const j = this.pos | 0, f = this.pos - j;
      L[i] = (cl[j] + (cl[j + 1] - cl[j]) * f) * this.gain;
      if (R !== L) R[i] = (cr[j] + (cr[j + 1] - cr[j]) * f) * this.gain;
    }
    if (this.mode === "stop" && this.gain < 0.001) this.gain = 0;
    if (++this.blocks % 8 === 0) this.port.postMessage({ type: "pos", pos: this.pos / this.bufRate, t: currentTime, seq: this.seq, playing: this.mode === "play" });
    return true;
  }
}
registerProcessor("ncvr-scratch", NcvrDeck);

// Program tap for WAV recording: forwards the master bus as raw stereo samples.
class NcvrTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false; this.size = 8192; this.reset();
    this.port.onmessage = (e) => { if (e.data.type === "start") { this.on = true; this.reset(); } else if (e.data.type === "stop") { this.flush(); this.on = false; this.port.postMessage({ type: "stopped" }); } };
  }
  reset() { this.l = new Float32Array(this.size); this.r = new Float32Array(this.size); this.n = 0; }
  flush() {
    if (!this.n) return;
    const l = this.l.slice(0, this.n), r = this.r.slice(0, this.n);
    this.port.postMessage({ type: "data", l, r }, [l.buffer, r.buffer]);
    this.reset();
  }
  process(inputs) {
    if (!this.on) return true;
    const inp = inputs[0];
    const a = inp[0], b = inp[1] || inp[0];
    if (!a) return true; // silent / disconnected
    for (let i = 0; i < a.length; i++) {
      this.l[this.n] = a[i]; this.r[this.n] = b[i]; this.n++;
      if (this.n === this.size) this.flush();
    }
    return true;
  }
}
registerProcessor("ncvr-tap", NcvrTap);
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
