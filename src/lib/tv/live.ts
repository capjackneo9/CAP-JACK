import "server-only";
import { config } from "../config";

export interface LiveVideoStatus { configured: boolean; live: boolean; hlsUrl: string | null; webrtcUrl: string | null; error?: string }

async function pathReady(apiUrl: string, path: string): Promise<boolean | null> {
  const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/v3/paths/get/${encodeURIComponent(path)}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
  if (res.status === 404) return false;
  if (!res.ok) return null;
  return Boolean(((await res.json()) as { ready?: boolean }).ready);
}

/**
 * Is a live video feed currently publishing to MediaMTX? When the Opus copy
 * ("<path>-rtc") is also up, viewers get a WebRTC (WHEP) URL for sub-second delay;
 * HLS stays as the fallback.
 */
export async function liveVideoStatus(): Promise<LiveVideoStatus> {
  const { apiUrl, path, hlsPublicBase, webrtcPublicBase } = config.liveVideo;
  if (!apiUrl) return { configured: false, live: false, hlsUrl: null, webrtcUrl: null };
  try {
    const ready = await pathReady(apiUrl, path);
    if (ready === null) return { configured: true, live: false, hlsUrl: null, webrtcUrl: null, error: "Live video server error" };
    if (!ready) return { configured: true, live: false, hlsUrl: null, webrtcUrl: null };
    const rtc = webrtcPublicBase !== "off" ? await pathReady(apiUrl, `${path}-rtc`).catch(() => false) : false;
    return {
      configured: true,
      live: true,
      hlsUrl: `${hlsPublicBase}/${path}/index.m3u8`,
      webrtcUrl: rtc ? `${webrtcPublicBase}/${path}-rtc/whep` : null,
    };
  } catch (e) {
    return { configured: true, live: false, hlsUrl: null, webrtcUrl: null, error: (e as Error).message };
  }
}
