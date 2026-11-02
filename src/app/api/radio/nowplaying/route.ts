import { NextResponse } from "next/server";
import { engine } from "@/lib/azuracast/client";
import { normalizeNowPlaying, type NowPlaying } from "@/lib/azuracast/normalize";
import { integrations } from "@/lib/config";
import { scheduledNow } from "@/lib/queries";
import { getStation } from "@/lib/db";

export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | null = null;
const TTL = 8_000;

export interface NowPlayingResponse {
  configured: boolean;
  nowPlaying: NowPlaying | null;
  error: string | null;
  program: { title: string; slug: string; host: string | null; format: string; source: string } | null;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.body, { headers: { "Cache-Control": "no-store" } });

  const sched = await scheduledNow().catch(() => null);
  const program = sched?.program
    ? { title: sched.program.title, slug: sched.program.slug, host: sched.program.host?.name ?? null, format: sched.program.format, source: sched.resolved?.source ?? "schedule" }
    : null;

  const body: NowPlayingResponse = { configured: integrations.azuracastPublic(), nowPlaying: null, error: null, program };
  if (body.configured) {
    try {
      const station = await getStation().catch(() => null);
      const showListeners = station?.showListenerCount ?? process.env.NEXT_PUBLIC_SHOW_LISTENER_COUNT === "true";
      body.nowPlaying = normalizeNowPlaying(await engine().nowPlaying(), {
        showListeners,
        streamUrlOverride: process.env.NEXT_PUBLIC_STREAM_URL || null,
      });
    } catch (e) {
      body.error = (e as Error).message;
    }
  }
  cache = { at: Date.now(), body };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
