/**
 * Linear "TV channel" clock: the approved music-video playlist loops forever
 * from a fixed epoch, so every viewer sees the same video at the same moment —
 * like a broadcast channel, without a video streaming server.
 */
export interface RotationVideo { id: string; durationSec: number }

export const TV_EPOCH = Date.UTC(2026, 0, 1); // fixed reference point

export interface RotationPosition {
  index: number;
  videoId: string;
  offsetSec: number;     // how far into the current video we are
  remainingSec: number;
  cycleSec: number;
}

export function rotationPosition(videos: RotationVideo[], now: number, epoch = TV_EPOCH): RotationPosition | null {
  const list = videos.filter((v) => v.durationSec > 0);
  const cycle = list.reduce((s, v) => s + v.durationSec, 0);
  if (!list.length || cycle <= 0) return null;
  let t = (((now - epoch) / 1000) % cycle + cycle) % cycle;
  for (let i = 0; i < list.length; i++) {
    if (t < list[i].durationSec) {
      return { index: i, videoId: list[i].id, offsetSec: t, remainingSec: list[i].durationSec - t, cycleSec: cycle };
    }
    t -= list[i].durationSec;
  }
  // Floating-point edge: wrap to the start.
  return { index: 0, videoId: list[0].id, offsetSec: 0, remainingSec: list[0].durationSec, cycleSec: cycle };
}

/** The next `count` videos after the current one (wrapping). */
export function upNext<T extends RotationVideo>(videos: T[], currentIndex: number, count = 3): T[] {
  const list = videos.filter((v) => v.durationSec > 0);
  return Array.from({ length: Math.min(count, Math.max(0, list.length - 1)) }, (_, i) => list[(currentIndex + 1 + i) % list.length]);
}
