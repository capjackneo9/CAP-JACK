import "server-only";
import { config } from "../config";

/** Is a live video feed currently publishing to MediaMTX? */
export async function liveVideoStatus(): Promise<{ configured: boolean; live: boolean; hlsUrl: string | null; error?: string }> {
  const { apiUrl, path, hlsPublicBase } = config.liveVideo;
  if (!apiUrl) return { configured: false, live: false, hlsUrl: null };
  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/v3/paths/get/${encodeURIComponent(path)}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (res.status === 404) return { configured: true, live: false, hlsUrl: null };
    if (!res.ok) return { configured: true, live: false, hlsUrl: null, error: `Live video server ${res.status}` };
    const j = (await res.json()) as { ready?: boolean };
    return { configured: true, live: Boolean(j.ready), hlsUrl: j.ready ? `${hlsPublicBase}/${path}/index.m3u8` : null };
  } catch (e) {
    return { configured: true, live: false, hlsUrl: null, error: (e as Error).message };
  }
}
