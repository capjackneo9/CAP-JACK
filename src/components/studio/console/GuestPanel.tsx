"use client";
import { useEffect, useRef, useState } from "react";
import type { MixEngine, Meter } from "@/lib/audio/engine";
import { MeterBar } from "./parts";

interface Invite { id: string; guestName: string; status: string; expiresAt: string; recordingAllowed: boolean; guestConsentedAt: string | null }
interface Live { invite: Invite; connected: boolean; onAir: boolean; muted: boolean; level: number; err?: string }

/**
 * Remote guests over WebRTC (LiveKit). Guest audio enters the mixer on a gated
 * channel that stays OFF the program bus until the host presses ON AIR.
 */
export function GuestPanel({ engine, meters, livekitConfigured }: { engine: MixEngine; meters: Record<string, Meter>; livekitConfigured: boolean }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [err, setErr] = useState<string | null>(null);
  const rooms = useRef<Record<string, { disconnect: () => Promise<void> }>>({});

  const refresh = () => fetch("/api/studio/guests").then((r) => r.json()).then((j) => setInvites((j.invites ?? []).filter((i: Invite) => ["PENDING", "WAITING", "ON_AIR"].includes(i.status)))).catch((e) => setErr(e.message));
  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id); }, []);
  useEffect(() => () => { Object.values(rooms.current).forEach((r) => r.disconnect()); }, []);

  async function connect(inv: Invite) {
    setErr(null);
    try {
      const r = await fetch(`/api/studio/guests/${inv.id}/token`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const room = new Room({ adaptiveStream: false });
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio || participant.identity !== j.guestIdentity) return;
        // Chrome only feeds WebRTC audio into Web Audio when it is also attached to a (muted) element.
        const el = track.attach() as HTMLAudioElement;
        el.muted = true;
        const stream = new MediaStream([track.mediaStreamTrack]);
        engine.addGuest(inv.id, inv.guestName, stream, j.consent);
        setLive((l) => ({ ...l, [inv.id]: { ...(l[inv.id] ?? { invite: inv, onAir: false, muted: false, level: 1 }), connected: true } }));
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        if (p.identity === j.guestIdentity) { engine.removeGuest(inv.id); setLive((l) => ({ ...l, [inv.id]: { ...l[inv.id], connected: false, onAir: false } })); }
      });
      await room.connect(j.url, j.token);
      // Talkback: the guest hears the host's raw mic (mix-minus — never their own voice).
      if (engine.micStream) await room.localParticipant.publishTrack(engine.micStream.getAudioTracks()[0], { name: "host-talkback" });
      rooms.current[inv.id] = room;
      setLive((l) => ({ ...l, [inv.id]: l[inv.id] ?? { invite: inv, connected: false, onAir: false, muted: false, level: 1 } }));
    } catch (e) { setErr((e as Error).message); }
  }

  async function setOnAir(id: string, onAir: boolean) {
    engine.setGuestOnAir(id, onAir);
    setLive((l) => ({ ...l, [id]: { ...l[id], onAir } }));
    await fetch(`/api/studio/guests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: onAir ? "on-air" : "off-air" }) });
  }
  async function setMuted(id: string, muted: boolean) {
    const r = await fetch(`/api/studio/guests/${id}/mute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted }) });
    if (!r.ok) return setErr((await r.json()).error);
    const g = engine.guests.get(id);
    if (g) g.gain.gain.value = muted ? 0 : live[id]?.level ?? 1;
    setLive((l) => ({ ...l, [id]: { ...l[id], muted } }));
  }
  async function end(id: string) {
    engine.removeGuest(id);
    await rooms.current[id]?.disconnect();
    delete rooms.current[id];
    await fetch(`/api/studio/guests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end" }) });
    setLive((l) => { const n = { ...l }; delete n[id]; return n; });
    refresh();
  }

  return (
    <section className="glass p-4" aria-label="Guest channels">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">GUEST CHANNELS</div>
        <a href="/studio/guests" className="text-xs text-[var(--color-gold)] hover:underline">Manage invites →</a>
      </div>
      {!livekitConfigured && <p className="text-sm text-[var(--color-muted)]">Guest rooms need a LiveKit server. Set <code>LIVEKIT_URL</code>, <code>LIVEKIT_API_KEY</code> and <code>LIVEKIT_API_SECRET</code>.</p>}
      {livekitConfigured && invites.length === 0 && <p className="text-sm text-[var(--color-muted)]">No active guest invitations.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {invites.map((inv) => {
          const l = live[inv.id];
          const consent = Boolean(inv.guestConsentedAt) && inv.recordingAllowed;
          return (
            <div key={inv.id} className={`rounded-xl border p-3 ${l?.onAir ? "border-[var(--color-live)] shadow-[var(--shadow-glow-live)]" : "border-white/10"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{inv.guestName}</div>
                  <div className="text-[10px] uppercase text-[var(--color-muted)]">{inv.status} · {consent ? "recording consent ✓" : "no recording consent"}</div>
                </div>
                <MeterBar meter={meters[inv.id]} label="G" vertical={false} tone="live" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {!rooms.current[inv.id] ? (
                  <button type="button" className="btn btn-ghost px-3 py-1 text-xs" disabled={!livekitConfigured} onClick={() => connect(inv)}>Join room</button>
                ) : (
                  <>
                    <button type="button" aria-pressed={l?.onAir} disabled={!l?.connected} onClick={() => setOnAir(inv.id, !l?.onAir)} className={`btn px-3 py-1 text-xs ${l?.onAir ? "btn-live" : "btn-ghost"}`}>{l?.onAir ? "ON AIR" : "Put on air"}</button>
                    <button type="button" aria-pressed={l?.muted} disabled={!l?.connected} onClick={() => setMuted(inv.id, !l?.muted)} className={`btn px-3 py-1 text-xs ${l?.muted ? "btn-danger" : "btn-ghost"}`}>{l?.muted ? "Unmute guest" : "Mute guest"}</button>
                    <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={() => end(inv.id)}>End</button>
                  </>
                )}
              </div>
              {rooms.current[inv.id] && !l?.connected && <p className="mt-1 text-[10px] text-[var(--color-muted)]">Waiting for guest audio…</p>}
            </div>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </section>
  );
}
