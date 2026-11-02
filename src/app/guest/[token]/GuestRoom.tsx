"use client";
import { useEffect, useRef, useState } from "react";

interface Info { guestName: string; show: string | null; expiresAt: string; recordingAllowed: boolean; status: string; mediaConfigured: boolean }

export function GuestRoom({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [micOk, setMicOk] = useState(false);
  const [level, setLevel] = useState(0);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"check" | "joining" | "waiting" | "ended">("check");
  const [hostAudio, setHostAudio] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const room = useRef<{ disconnect: () => Promise<void> } | null>(null);

  useEffect(() => {
    fetch(`/api/guest/${token}`).then(async (r) => { const j = await r.json(); if (!r.ok) setErr(j.error); else setInfo(j); }).catch((e) => setErr(e.message));
    return () => { stream.current?.getTracks().forEach((t) => t.stop()); room.current?.disconnect(); };
  }, [token]);

  async function checkMic() {
    setErr(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream.current).connect(an);
      const data = new Float32Array(an.fftSize);
      const tick = () => { an.getFloatTimeDomainData(data); setLevel(Math.min(1, Math.max(...data.map(Math.abs)) * 1.5)); if (stream.current?.active) requestAnimationFrame(tick); };
      tick();
      setMicOk(true);
    } catch (e) {
      setErr((e as Error).name === "NotAllowedError" ? "Microphone access was blocked. Allow the microphone in your browser settings and try again." : (e as Error).message);
    }
  }

  async function join() {
    setPhase("joining"); setErr(null);
    try {
      const r = await fetch(`/api/guest/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordingConsent: consent }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const { Room, RoomEvent, Track } = await import("livekit-client");
      const rm = new Room();
      rm.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio) { document.body.appendChild(track.attach()); setHostAudio(true); } });
      rm.on(RoomEvent.Disconnected, () => setPhase("ended"));
      await rm.connect(j.url, j.token);
      await rm.localParticipant.publishTrack(stream.current!.getAudioTracks()[0], { name: "guest-mic", source: Track.Source.Microphone });
      room.current = rm;
      setPhase("waiting");
    } catch (e) { setErr((e as Error).message); setPhase("check"); }
  }

  if (err && !info) return <div role="alert" className="glass p-6 text-red-200">{err}</div>;
  if (!info) return <div className="glass p-6">Checking your invitation…</div>;
  if (phase === "ended") return <div className="glass p-6"><h1 className="text-xl font-bold">Thanks for joining NCVR</h1><p className="mt-2 text-[var(--color-muted)]">The session has ended. You can close this page.</p></div>;

  return (
    <div className="glass space-y-5 p-6">
      <div>
        <div className="kicker">NCVR guest studio</div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold">Welcome, {info.guestName}</h1>
        {info.show && <p className="text-[var(--color-gold)]">{info.show}</p>}
      </div>
      {phase === "waiting" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 p-4">
            <div className="font-bold text-[var(--color-gold)]">You&apos;re in the waiting room</div>
            <p className="mt-1 text-sm">You are <strong>not on air</strong> until the host brings you on. Keep this tab open and use headphones.</p>
          </div>
          <LevelBar level={level} />
          <p className="text-xs text-[var(--color-muted)]">{hostAudio ? "You can hear the host." : "The host's talkback will play here when they connect."}</p>
          <button type="button" className="btn btn-ghost" onClick={async () => { await room.current?.disconnect(); stream.current?.getTracks().forEach((t) => t.stop()); setPhase("ended"); }}>Leave</button>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            <li>Plug in headphones (prevents echo on air).</li>
            <li>Test your microphone below.</li>
            <li>Join the waiting room. The host decides when you go on air.</li>
          </ol>
          {!micOk ? <button type="button" className="btn btn-primary" onClick={checkMic}>Test microphone</button> : <LevelBar level={level} />}
          {micOk && <p className="text-xs text-[var(--color-signal)]">Microphone working — speak and watch the meter.</p>}
          {info.recordingAllowed && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[var(--color-gold)]" />
              <span>I consent to NCVR recording this broadcast segment for rebroadcast and promotion. (Optional — without consent, your segment will not be recorded.)</span>
            </label>
          )}
          {!info.mediaConfigured && <p className="text-sm text-[var(--color-gold)]">The station&apos;s guest studio is not configured yet — please contact your host.</p>}
          <button type="button" className="btn btn-live" disabled={!micOk || !info.mediaConfigured || phase === "joining"} onClick={join}>{phase === "joining" ? "Joining…" : "Join waiting room"}</button>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <p className="text-[10px] text-[var(--color-muted)]">Link valid until {new Date(info.expiresAt).toLocaleString()}.</p>
    </div>
  );
}

function LevelBar({ level }: { level: number }) {
  return (
    <div role="meter" aria-label="Your microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-3 w-full overflow-hidden rounded bg-black/60">
      <div className="h-full bg-[var(--color-signal)] transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
    </div>
  );
}
