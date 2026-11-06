/**
 * WAV (16-bit PCM, stereo) recording of the console's program bus.
 * Samples come from the "ncvr-tap" AudioWorklet; they are converted to
 * 16-bit as they arrive and parked in Blobs so long shows don't fill memory.
 */

/** 44-byte RIFF/WAVE header for 16-bit PCM. */
export function wavHeader(dataBytes: number, sampleRate: number, channels = 2): ArrayBuffer {
  const h = new DataView(new ArrayBuffer(44));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  const blockAlign = channels * 2;
  str(0, "RIFF"); h.setUint32(4, 36 + dataBytes, true); str(8, "WAVE");
  str(12, "fmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, channels, true);
  h.setUint32(24, sampleRate, true); h.setUint32(28, sampleRate * blockAlign, true); h.setUint16(32, blockAlign, true); h.setUint16(34, 16, true);
  str(36, "data"); h.setUint32(40, dataBytes, true);
  return h.buffer;
}

/** Interleave two channels as 16-bit little-endian PCM (clipped). */
export function toPcm16(l: Float32Array, r: Float32Array): Int16Array {
  const out = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    const a = Math.max(-1, Math.min(1, l[i])), b = Math.max(-1, Math.min(1, r[i]));
    out[2 * i] = a < 0 ? a * 0x8000 : a * 0x7fff;
    out[2 * i + 1] = b < 0 ? b * 0x8000 : b * 0x7fff;
  }
  return out;
}

/** WAV files above 4 GB are invalid; stop well before (≈ 6 h at 48 kHz stereo). */
export const WAV_MAX_BYTES = 4_000_000_000;

export class WavRecorder {
  private parts: Blob[] = [];
  private pending: Int16Array[] = [];
  private pendingBytes = 0;
  bytes = 0;
  startedAt: number | null = null;
  private stopResolve: (() => void) | null = null;

  constructor(private tap: AudioWorkletNode, private sampleRate: number, private onLimit?: () => void) {
    tap.port.onmessage = (e) => {
      const m = e.data as { type: string; l?: Float32Array; r?: Float32Array };
      if (m.type === "data" && m.l && m.r && this.startedAt !== null) {
        const pcm = toPcm16(m.l, m.r);
        this.pending.push(pcm);
        this.pendingBytes += pcm.byteLength;
        this.bytes += pcm.byteLength;
        if (this.pendingBytes > 4 * 1024 * 1024) this.park();
        if (this.bytes > WAV_MAX_BYTES) this.onLimit?.();
      } else if (m.type === "stopped") {
        this.stopResolve?.();
      }
    };
  }
  private park() {
    if (!this.pending.length) return;
    this.parts.push(new Blob(this.pending as BlobPart[]));
    this.pending = []; this.pendingBytes = 0;
  }
  get recording() { return this.startedAt !== null; }
  start() {
    this.parts = []; this.pending = []; this.pendingBytes = 0; this.bytes = 0;
    this.startedAt = Date.now();
    this.tap.port.postMessage({ type: "start" });
  }
  async stop(): Promise<Blob> {
    if (this.startedAt === null) return new Blob([], { type: "audio/wav" });
    await new Promise<void>((resolve) => {
      this.stopResolve = resolve;
      this.tap.port.postMessage({ type: "stop" });
      setTimeout(resolve, 1000); // never hang if the audio thread is gone
    });
    this.stopResolve = null;
    this.startedAt = null;
    this.park();
    return new Blob([wavHeader(this.bytes, this.sampleRate), ...this.parts], { type: "audio/wav" });
  }
}
