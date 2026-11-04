"use client";
import { SCRATCH_WORKLET, clampPosition } from "./scratch";
/**
 * NCVR browser mixing engine (Web Audio API).
 *
 *  Deck A ─┐                                ┌─► monitorBus ─► speakers (LOCAL MONITOR ONLY)
 *  Deck B ─┼─ xfade ─► musicBus (ducking) ──┤
 *  Pads  ──┘                                └─► programBus ─► master ─► meters
 *  Mic ─ gain ─ EQ ─ FX(echo/reverb) ─ micGate ─────────────► programBus      └─► programOut (MediaStream)
 *  Guests ─ gain ─ onAirGate (default closed) ──────────────► programBus           ├─► Webcaster (transmit)
 *  cue sends (pre-fader) ─► cueBus ─► headphone sink (setSinkId)                    └─► Recorder
 *
 * Only `programOut` is transmitted. The local monitor never reaches listeners.
 */

export type DeckId = "A" | "B";

export interface Meter { peak: number; rms: number }

function makeImpulse(ctx: BaseAudioContext, seconds = 2.4, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function readMeter(an: AnalyserNode, data: Float32Array<ArrayBuffer>): Meter {
  an.getFloatTimeDomainData(data);
  let peak = 0, sum = 0;
  for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; sum += v * v; }
  return { peak, rms: Math.sqrt(sum / data.length) };
}

export class EQ3 {
  low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; filter: BiquadFilterNode;
  constructor(ctx: AudioContext) {
    this.low = new BiquadFilterNode(ctx, { type: "lowshelf", frequency: 250 });
    this.mid = new BiquadFilterNode(ctx, { type: "peaking", frequency: 1000, Q: 0.9 });
    this.high = new BiquadFilterNode(ctx, { type: "highshelf", frequency: 4000 });
    this.filter = new BiquadFilterNode(ctx, { type: "allpass", frequency: 1000 });
    this.low.connect(this.mid).connect(this.high).connect(this.filter);
  }
  get input() { return this.low; }
  get output() { return this.filter; }
  /** -1 … 1: negative = low-pass sweep, positive = high-pass sweep, 0 = bypass. */
  setFilter(v: number) {
    if (Math.abs(v) < 0.02) { this.filter.type = "allpass"; return; }
    this.filter.type = v < 0 ? "lowpass" : "highpass";
    this.filter.frequency.value = v < 0 ? 20000 * Math.pow(10, v * 2.6) : 20 * Math.pow(10, v * 2.7);
  }
}

export class Deck {
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  trim: GainNode; eq: EQ3; fader: GainNode; xf: GainNode; cue: GainNode; analyser: AnalyserNode;
  peaks: Float32Array | null = null;
  title = ""; artist = "";
  private objectUrl: string | null = null;
  /** Scratch voice (AudioWorklet) — null until the worklet loads, or if the browser lacks AudioWorklet. */
  scratchNode: AudioWorkletNode | null = null;
  scratchReady = false;
  scratching = false;
  private scratchSec = 0;
  private bufferRate = 44100;
  private resumeAfterScratch = false;
  constructor(private ctx: AudioContext, public id: DeckId, musicBus: AudioNode, cueBus: AudioNode, private worklet: Promise<boolean> = Promise.resolve(false)) {
    this.el = new Audio();
    this.el.crossOrigin = "use-credentials";
    this.el.preload = "auto";
    this.src = ctx.createMediaElementSource(this.el);
    this.trim = new GainNode(ctx, { gain: 1 });
    this.eq = new EQ3(ctx);
    this.fader = new GainNode(ctx, { gain: 0.8 });
    this.xf = new GainNode(ctx, { gain: 1 });
    this.cue = new GainNode(ctx, { gain: 0 });
    this.analyser = new AnalyserNode(ctx, { fftSize: 1024 });
    this.src.connect(this.trim).connect(this.eq.input);
    this.eq.output.connect(this.fader).connect(this.xf).connect(musicBus);
    this.eq.output.connect(this.analyser);
    this.eq.output.connect(this.cue).connect(cueBus); // pre-fader listen
    this.worklet.then((ok) => {
      if (!ok) return;
      this.scratchNode = new AudioWorkletNode(ctx, "ncvr-scratch", { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      this.scratchNode.connect(this.trim);
    }).catch(() => null);
  }
  async load(source: File | string, meta: { title: string; artist?: string }) {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.peaks = null;
    if (this.scratching) this.endScratch();
    this.scratchReady = false;
    this.scratchNode?.port.postMessage({ type: "unload" });
    const url = typeof source === "string" ? source : (this.objectUrl = URL.createObjectURL(source));
    this.el.src = url;
    this.title = meta.title; this.artist = meta.artist ?? "";
    // Waveform overview
    try {
      const data = typeof source === "string" ? await (await fetch(source, { credentials: "include" })).arrayBuffer() : await source.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data);
      this.peaks = computePeaks(buf, 800);
      await this.worklet;
      if (this.scratchNode) {
        const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i).slice());
        this.bufferRate = buf.sampleRate;
        this.scratchNode.port.postMessage({ type: "load", channels, sampleRate: buf.sampleRate }, channels.map((c) => c.buffer));
        this.scratchReady = true;
      }
    } catch { this.peaks = null; }
  }
  /** Platter touched: hold the record. Returns false when scratch audio is unavailable (fall back to nudge). */
  beginScratch(): boolean {
    if (!this.scratchNode || !this.scratchReady) return false;
    if (this.scratching) return true;
    this.resumeAfterScratch = this.playing;
    this.scratchSec = this.el.currentTime;
    this.el.pause();
    this.scratchNode.port.postMessage({ type: "start", pos: this.scratchSec, bufferRate: this.bufferRate });
    this.scratching = true;
    return true;
  }
  /** Move the record by `seconds` (negative = backwards). */
  scratchBy(seconds: number) {
    if (!this.scratching || !this.scratchNode) return;
    this.scratchSec = clampPosition(this.scratchSec + seconds, this.el.duration);
    this.scratchNode.port.postMessage({ type: "target", pos: this.scratchSec, bufferRate: this.bufferRate });
  }
  /** Platter released: playback continues from where the record was left. */
  endScratch() {
    if (!this.scratching) return;
    this.scratching = false;
    this.scratchNode?.port.postMessage({ type: "stop" });
    this.el.currentTime = this.scratchSec;
    if (this.resumeAfterScratch) this.el.play().catch(() => null);
  }
  /** Current position, including while scratching (the element is paused then). */
  get position() { return this.scratching ? this.scratchSec : this.el.currentTime; }
  play() { return this.el.play(); }
  pause() { this.el.pause(); }
  get playing() { return this.scratching ? this.resumeAfterScratch : !this.el.paused && !this.el.ended; }
}

export function computePeaks(buf: AudioBuffer, buckets: number): Float32Array {
  const ch = buf.getChannelData(0);
  const size = Math.max(1, Math.floor(ch.length / buckets));
  const out = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let m = 0;
    for (let j = i * size; j < Math.min(ch.length, (i + 1) * size); j++) { const v = Math.abs(ch[j]); if (v > m) m = v; }
    out[i] = m;
  }
  return out;
}

export type MicInput = "1" | "2" | "both";

export interface GuestChannel { id: string; name: string; source: MediaStreamAudioSourceNode; gain: GainNode; gate: GainNode; analyser: AnalyserNode; onAir: boolean; consent: boolean }

export class MixEngine {
  ctx: AudioContext;
  musicBus: GainNode; programBus: GainNode; master: GainNode; monitorBus: GainNode; cueBus: GainNode; padBus: GainNode;
  programOut: MediaStreamAudioDestinationNode;
  cueOut: MediaStreamAudioDestinationNode;
  programAnalyserL: AnalyserNode; programAnalyserR: AnalyserNode;
  decks: Record<DeckId, Deck>;
  // mic chain
  micStream: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micGain: GainNode; micEq: EQ3; micGate: GainNode; micAnalyser: AnalyserNode;
  echoSend: GainNode; echo: DelayNode; echoFb: GainNode; reverbSend: GainNode; reverb: ConvolverNode; micMonitor: GainNode;
  micOpen = false; micMuted = false; duckingEnabled = true; duckLevel = 0.3;
  guests = new Map<string, GuestChannel>();
  pads = new Map<number, { buffer: AudioBuffer; name: string }>();
  private crossfade = 0.5;
  private buf = new Float32Array(1024) as Float32Array<ArrayBuffer>;
  private cueEl: HTMLAudioElement | null = null;

  constructor() {
    // "balanced" gives the audio thread a bigger buffer than "interactive": no crackle/dropouts
    // while the console UI is busy, at the cost of a few ms of local monitor latency.
    const ctx = (this.ctx = new AudioContext({ latencyHint: "balanced" }));
    const worklet: Promise<boolean> = ctx.audioWorklet
      ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([SCRATCH_WORKLET], { type: "text/javascript" }))).then(() => true, () => false)
      : Promise.resolve(false);
    this.musicBus = new GainNode(ctx, { gain: 1 });
    this.padBus = new GainNode(ctx, { gain: 0.9 });
    this.programBus = new GainNode(ctx);
    this.master = new GainNode(ctx, { gain: 0.9 });
    this.monitorBus = new GainNode(ctx, { gain: 0.7 });
    this.cueBus = new GainNode(ctx, { gain: 1 });
    this.programOut = ctx.createMediaStreamDestination();
    this.cueOut = ctx.createMediaStreamDestination();
    this.programAnalyserL = new AnalyserNode(ctx, { fftSize: 1024 });
    this.programAnalyserR = new AnalyserNode(ctx, { fftSize: 1024 });

    this.musicBus.connect(this.programBus);
    this.padBus.connect(this.programBus);
    this.programBus.connect(this.master);
    this.master.connect(this.programOut);
    const split = ctx.createChannelSplitter(2);
    this.master.connect(split);
    split.connect(this.programAnalyserL, 0);
    split.connect(this.programAnalyserR, 1);
    // Local monitor: music + pads + guests (mic excluded by default to prevent feedback)
    this.musicBus.connect(this.monitorBus);
    this.padBus.connect(this.monitorBus);
    this.monitorBus.connect(ctx.destination);
    this.cueBus.connect(this.cueOut);

    this.decks = { A: new Deck(ctx, "A", this.musicBus, this.cueBus, worklet), B: new Deck(ctx, "B", this.musicBus, this.cueBus, worklet) };
    this.setCrossfade(0.5);

    // Mic chain (source attached in enableMic)
    this.micGain = new GainNode(ctx, { gain: 1 });
    this.micEq = new EQ3(ctx);
    this.micGate = new GainNode(ctx, { gain: 0 });
    this.micAnalyser = new AnalyserNode(ctx, { fftSize: 1024 });
    this.micMonitor = new GainNode(ctx, { gain: 0 });
    this.echoSend = new GainNode(ctx, { gain: 0 });
    this.echo = new DelayNode(ctx, { delayTime: 0.32, maxDelayTime: 2 });
    this.echoFb = new GainNode(ctx, { gain: 0.35 });
    this.reverbSend = new GainNode(ctx, { gain: 0 });
    this.reverb = new ConvolverNode(ctx, { buffer: makeImpulse(ctx) });
    this.micGain.connect(this.micEq.input);
    this.micEq.output.connect(this.micAnalyser);
    this.micEq.output.connect(this.micGate);
    this.micEq.output.connect(this.echoSend).connect(this.echo);
    this.echo.connect(this.echoFb).connect(this.echo);
    this.echo.connect(this.micGate);
    this.micEq.output.connect(this.reverbSend).connect(this.reverb).connect(this.micGate);
    this.micGate.connect(this.programBus);
    this.micGate.connect(this.micMonitor).connect(this.monitorBus);
  }

  async resume() { if (this.ctx.state !== "running") await this.ctx.resume(); }

  setCrossfade(x: number) {
    this.crossfade = Math.min(1, Math.max(0, x));
    const t = this.ctx.currentTime;
    this.decks.A.xf.gain.setTargetAtTime(Math.cos(this.crossfade * Math.PI / 2), t, 0.01);
    this.decks.B.xf.gain.setTargetAtTime(Math.sin(this.crossfade * Math.PI / 2), t, 0.01);
  }

  /**
   * Open a microphone / audio interface. `input` picks the interface channel:
   * 1 = left / input 1, 2 = right / input 2, "both" = sum (e.g. UA Volt 2 with
   * the mic in either jack). `voiceProcessing` turns on the browser's noise
   * suppression / echo cancellation — off by default because it chops music
   * and makes good mics sound underwater.
   */
  async enableMic(deviceId?: string, opts: { input?: MicInput; voiceProcessing?: boolean } = {}) {
    const input = opts.input ?? "both";
    const vp = opts.voiceProcessing ?? false;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: vp, noiseSuppression: vp, autoGainControl: false,
        channelCount: { ideal: 2 },
      },
    });
    this.micSource?.disconnect();
    this.micPick?.disconnect();
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    const channels = this.micStream.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
    this.micChannels = channels;
    if (channels < 2) {
      this.micPick = null;
      this.micSource.connect(this.micGain);
      return;
    }
    // Pick the interface input → mono voice
    const split = this.ctx.createChannelSplitter(2);
    const sum = new GainNode(this.ctx, { channelCount: 1, channelCountMode: "explicit", channelInterpretation: "speakers" });
    this.micSource.connect(split);
    if (input === "1" || input === "both") split.connect(sum, 0);
    if (input === "2" || input === "both") split.connect(sum, 1);
    sum.connect(this.micGain);
    this.micPick = split;
  }
  micPick: AudioNode | null = null;
  micChannels = 0;

  setMicOpen(open: boolean) { this.micOpen = open; this.applyMic(); }
  setMicMuted(m: boolean) { this.micMuted = m; this.applyMic(); }
  private applyMic() {
    const live = this.micOpen && !this.micMuted && !!this.micSource;
    const t = this.ctx.currentTime;
    this.micGate.gain.setTargetAtTime(live ? 1 : 0, t, 0.02);
    // Talk-over ducking of the music bus
    const duck = live && this.duckingEnabled ? this.duckLevel : 1;
    this.musicBus.gain.setTargetAtTime(duck, t, live ? 0.05 : 0.25);
  }
  setDucking(enabled: boolean, level = this.duckLevel) { this.duckingEnabled = enabled; this.duckLevel = level; this.applyMic(); }

  /** Route cue bus to a specific output device (headphones) where the browser supports setSinkId. */
  async setCueDevice(deviceId: string | null): Promise<boolean> {
    if (!this.cueEl) { this.cueEl = new Audio(); this.cueEl.srcObject = this.cueOut.stream; }
    const el = this.cueEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (!deviceId) { el.pause(); return true; }
    if (!el.setSinkId) return false;
    await el.setSinkId(deviceId);
    await el.play();
    return true;
  }

  async loadPad(slot: number, file: File | string, name: string) {
    const data = typeof file === "string" ? await (await fetch(file, { credentials: "include" })).arrayBuffer() : await file.arrayBuffer();
    this.pads.set(slot, { buffer: await this.ctx.decodeAudioData(data), name });
  }
  firePad(slot: number) {
    const p = this.pads.get(slot);
    if (!p) return false;
    const s = new AudioBufferSourceNode(this.ctx, { buffer: p.buffer });
    s.connect(this.padBus);
    s.start();
    return true;
  }

  addGuest(id: string, name: string, stream: MediaStream, consent: boolean) {
    this.removeGuest(id);
    const source = this.ctx.createMediaStreamSource(stream);
    const gain = new GainNode(this.ctx, { gain: 1 });
    const gate = new GainNode(this.ctx, { gain: 0 }); // never on air until the host says so
    const analyser = new AnalyserNode(this.ctx, { fftSize: 1024 });
    source.connect(gain);
    gain.connect(analyser);
    gain.connect(gate).connect(this.programBus);
    gain.connect(this.cueBus);
    this.guests.set(id, { id, name, source, gain, gate, analyser, onAir: false, consent });
  }
  setGuestOnAir(id: string, onAir: boolean) {
    const g = this.guests.get(id);
    if (!g) return;
    g.onAir = onAir;
    g.gate.gain.setTargetAtTime(onAir ? 1 : 0, this.ctx.currentTime, 0.02);
  }
  removeGuest(id: string) {
    const g = this.guests.get(id);
    if (!g) return;
    g.source.disconnect(); g.gain.disconnect(); g.gate.disconnect();
    this.guests.delete(id);
  }

  meters() {
    return {
      programL: readMeter(this.programAnalyserL, this.buf),
      programR: readMeter(this.programAnalyserR, this.buf),
      deckA: readMeter(this.decks.A.analyser, this.buf),
      deckB: readMeter(this.decks.B.analyser, this.buf),
      mic: readMeter(this.micAnalyser, this.buf),
      guests: Object.fromEntries([...this.guests.values()].map((g) => [g.id, readMeter(g.analyser, this.buf)])),
    };
  }

  /** Recording is blocked while any on-air guest has not consented. */
  canRecord(): { ok: boolean; reason?: string } {
    const missing = [...this.guests.values()].filter((g) => g.onAir && !g.consent);
    return missing.length ? { ok: false, reason: `No recording consent from: ${missing.map((g) => g.name).join(", ")}` } : { ok: true };
  }

  dispose() {
    this.micStream?.getTracks().forEach((t) => t.stop());
    Object.values(this.decks).forEach((d) => d.pause());
    this.ctx.close();
  }
}
