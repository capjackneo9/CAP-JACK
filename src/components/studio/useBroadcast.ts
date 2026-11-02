"use client";
import { useEffect, useState } from "react";
import type { NowPlaying } from "@/lib/azuracast/normalize";

export interface BroadcastInfo {
  configured: boolean;
  adminConfigured: boolean;
  nowPlaying: NowPlaying | null;
  engine: { backend_running: boolean; frontend_running: boolean } | null;
  engineError?: string;
  error: string | null;
}

/** Polls the studio broadcast endpoint (real AzuraCast data only). */
export function useBroadcast(intervalMs = 5000) {
  const [info, setInfo] = useState<BroadcastInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/studio/broadcast", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) setFetchError(j.error ?? `HTTP ${r.status}`);
        else { setInfo(j); setFetchError(null); }
      } catch (e) { if (alive) setFetchError((e as Error).message); }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return { info, fetchError };
}
