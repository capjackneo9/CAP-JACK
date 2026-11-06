import { describe, expect, it } from "vitest";
import { toPcm16, wavHeader } from "../src/lib/audio/wav";

describe("WAV recording format", () => {
  it("writes a valid 16-bit stereo PCM header", () => {
    const h = new DataView(wavHeader(4000, 48000));
    const tag = (o: number) => String.fromCharCode(h.getUint8(o), h.getUint8(o + 1), h.getUint8(o + 2), h.getUint8(o + 3));
    expect(tag(0)).toBe("RIFF");
    expect(h.getUint32(4, true)).toBe(4036);
    expect(tag(8)).toBe("WAVE");
    expect(h.getUint16(20, true)).toBe(1);      // PCM
    expect(h.getUint16(22, true)).toBe(2);      // stereo
    expect(h.getUint32(24, true)).toBe(48000);
    expect(h.getUint32(28, true)).toBe(192000); // bytes per second
    expect(h.getUint16(34, true)).toBe(16);
    expect(tag(36)).toBe("data");
    expect(h.getUint32(40, true)).toBe(4000);
  });
  it("interleaves L/R and clips to 16-bit", () => {
    const pcm = toPcm16(new Float32Array([0, 1, -1, 2]), new Float32Array([0.5, -0.5, 0, -2]));
    expect(Array.from(pcm)).toEqual([0, 16383, 32767, -16384, -32768, 0, 32767, -32768]);
  });
});
