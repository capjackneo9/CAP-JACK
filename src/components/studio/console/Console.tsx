"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MixEngine, type Meter } from "@/lib/audio/engine";
import { ProgramRecorder, Webcaster } from "@/lib/audio/webcaster";
import { deriveOnAir, ON_AIR_LABEL, type TransportState } from "@/lib/audio/onair";
import { useBroadcast } from "../useBroadcast";
import { DeckPanel, type LibraryTrack } from "./DeckPanel";
import { ConfirmAction, Knob, MeterBar, fmtTime } from "./parts";
import { GuestPanel } from "./GuestPanel";
import { Emblem } from "../../brand/Logo";

type Meters = ReturnType<MixEngine["meters"]>;

export interface ConsoleProps {
  webcastUrl: string | null;
  webDjUrl: string | null;
  canReturnToAutoDJ: boolean;
  canInviteGuests: boolean;
  livekitConfigured: boolean;
}

export function Console(props: ConsoleProps) {
  const [engine, setEngine] = useState<MixEngine | null>(null);
  const [powerErr, setPowerErr] = useState<string | null>(null);
  const [meters, setMeters] = useState<Meters | null>(null);
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [libErr, setLibErr] = useState<string | null>(null);

  // Load approved library tracks for decks / pads / queue
  useEffect(() => {
    fetch("/api/studio/library?status=APPROVED").then(async (r) => {
      const j = await r.json();
      if (!r.ok) setLibErr(j.error); else setLibrary(j.tracks);
    }).catch((e) => setLibErr(e.message));
  }, []);

  // Meter loop
  useEffect(() => {
    if (!engine) return;
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last > 60) { last = t; setMeters(engine.meters()); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  useEffect(() => () => engine?.dispose(), [engine]);

  async function powerOn() {
    try {
      const e = new MixEngine();
      await e.resume();
      setEngine(e);
    } catch (err) { setPowerErr((err as Error).message); }
  }

  if (!engine) {
    return (
      <div className="glass grid min-h-[50vh] place-items-center p-8 text-center">
        <div className="max-w-lg space-y-4">
          <div className="mx-auto w-36"><Emblem /></div>
          <div className="kicker">NCVR // Control system</div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-black">Broadcast studio</h1>
          <p className="text-sm text-[var(--color-muted)]">Powering on starts the browser audio engine. Nothing is transmitted until you connect to the broadcast server and AzuraCast confirms your live source.</p>
          <button type="button" className="btn btn-gold" onClick={powerOn}>Power on console</button>
          {powerErr && <p className="text-sm text-red-300">{powerErr}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TransmitPanel engine={engine} {...props} />
      {libErr && <p className="text-sm text-red-300">Library: {libErr}</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <DeckPanel deck={engine.decks.A} meter={meters?.deckA} library={library} label="DECK A" sub="Primary music" />
        <MasterSection engine={engine} meters={meters} />
        <DeckPanel deck={engine.decks.B} meter={meters?.deckB} library={library} label="DECK B" sub="Next track / cue" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MicChannel engine={engine} meter={meters?.mic} />
        <PadBank engine={engine} library={library} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <QueuePanel engine={engine} library={library} />
        <RecorderPanel engine={engine} />
      </div>
      {props.canInviteGuests && <GuestPanel engine={engine} meters={meters?.guests ?? {}} livekitConfigured={props.livekitConfigured} />}
    </div>
  );
}

function MasterSection({ engine, meters }: { engine: MixEngine; meters: Meters | null }) {
  const [xf, setXf] = useState(0.5);
  const [master, setMaster] = useState(0.9);
  const [monitor, setMonitor] = useState(0.7);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [cueMsg, setCueMsg] = useState<string | null>(null);
  useEffect(() => { engine.setCrossfade(xf); }, [engine, xf]);
  useEffect(() => { engine.master.gain.value = master; }, [engine, master]);
  useEffect(() => { engine.monitorBus.gain.value = monitor; }, [engine, monitor]);
  useEffect(() => { navigator.mediaDevices?.enumerateDevices().then((d) => setOutputs(d.filter((x) => x.kind === "audiooutput"))).catch(() => null); }, []);
  return (
    <section className="glass flex flex-col gap-4 p-4 xl:w-72" aria-label="Master section">
      <div className="kicker text-center">Program</div>
      <div className="flex justify-center gap-3">
        <MeterBar meter={meters?.programL} label="L" />
        <MeterBar meter={meters?.programR} label="R" />
      </div>
      <Knob label="Master out (transmitted)" value={master} min={0} max={1.2} onChange={setMaster} tone="ncvr-range-live" />
      <div>
        <label htmlFor="xfader" className="flex justify-between font-mono text-[10px] uppercase text-[var(--color-muted)]"><span>A</span><span>Crossfader</span><span>B</span></label>
        <input id="xfader" type="range" min={0} max={1} step={0.01} value={xf} onChange={(e) => setXf(Number(e.target.value))} className="ncvr-range-gold w-full" />
        <div className="mt-1 flex justify-between">
          <button type="button" className="text-[10px] text-[var(--color-muted)] hover:text-white" onClick={() => setXf(0)}>Snap A</button>
          <button type="button" className="text-[10px] text-[var(--color-muted)] hover:text-white" onClick={() => setXf(0.5)}>Center</button>
          <button type="button" className="text-[10px] text-[var(--color-muted)] hover:text-white" onClick={() => setXf(1)}>Snap B</button>
        </div>
      </div>
      <div className="rounded-lg border border-white/10 p-3">
        <div className="kicker mb-2 text-[10px]">Local monitor only</div>
        <Knob label="Speaker monitor" value={monitor} min={0} max={1} onChange={setMonitor} />
        <label className="label mt-3" htmlFor="cue-out">Headphone cue output</label>
        <select id="cue-out" className="field text-xs" defaultValue="" onChange={async (e) => {
          const ok = await engine.setCueDevice(e.target.value || null).catch((er) => { setCueMsg(er.message); return false; });
          setCueMsg(ok ? null : "This browser cannot route cue audio to a separate device (setSinkId unsupported).");
        }}>
          <option value="">Off</option>
          {outputs.map((o) => <option key={o.deviceId} value={o.deviceId}>{o.label || "Output device"}</option>)}
        </select>
        {cueMsg && <p className="mt-1 text-[10px] text-[var(--color-gold)]">{cueMsg}</p>}
        <p className="mt-2 text-[10px] text-[var(--color-muted)]">Monitor & cue never reach listeners. Only the master program bus is transmitted.</p>
      </div>
    </section>
  );
}

function MicChannel({ engine, meter }: { engine: MixEngine; meter?: Meter }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [gain, setGain] = useState(1);
  const [ducking, setDucking] = useState(true);
  const [duckLevel, setDuckLevel] = useState(0.3);
  const [echo, setEcho] = useState(0);
  const [reverb, setReverb] = useState(0);
  const [monitor, setMonitor] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refreshDevices = useCallback(() => navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput"))), []);
  useEffect(() => { refreshDevices().catch(() => null); }, [refreshDevices]);
  useEffect(() => { engine.micGain.gain.value = gain; }, [engine, gain]);
  useEffect(() => { engine.setDucking(ducking, duckLevel); }, [engine, ducking, duckLevel]);
  useEffect(() => { engine.echoSend.gain.value = echo; }, [engine, echo]);
  useEffect(() => { engine.reverbSend.gain.value = reverb; }, [engine, reverb]);
  useEffect(() => { engine.micMonitor.gain.value = monitor ? 1 : 0; }, [engine, monitor]);
  useEffect(() => { engine.setMicOpen(open); }, [engine, open]);
  useEffect(() => { engine.setMicMuted(muted); }, [engine, muted]);

  async function enable(deviceId?: string) {
    setErr(null);
    try { await engine.enableMic(deviceId); setEnabled(true); refreshDevices(); }
    catch (e) { setErr((e as Error).name === "NotAllowedError" ? "Microphone permission was denied." : (e as Error).message); }
  }

  return (
    <section className="glass p-4" aria-label="Microphone channel">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">MIC 1 — HOST</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Microphone channel</div>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${open && !muted && enabled ? "bg-[var(--color-live)] text-white shadow-[var(--shadow-glow-live)]" : "bg-white/10 text-[var(--color-muted)]"}`}>
          {open && !muted && enabled ? "MIC OPEN" : "MIC CLOSED"}
        </span>
      </header>
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select aria-label="Microphone device" className="field max-w-xs text-xs" onChange={(e) => enable(e.target.value || undefined)} defaultValue="">
              <option value="">{enabled ? "Default microphone" : "Select microphone…"}</option>
              {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
            </select>
            {!enabled && <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => enable()}>Enable mic</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={open} disabled={!enabled} onClick={() => setOpen(!open)}
              className={`btn px-5 py-2 text-sm ${open ? "btn-live" : "btn-ghost"}`}>{open ? "MIC ON" : "MIC OFF"}</button>
            <button type="button" aria-pressed={muted} disabled={!enabled} onClick={() => setMuted(!muted)} className={`btn px-4 py-2 text-sm ${muted ? "btn-danger" : "btn-ghost"}`}>{muted ? "Muted" : "Mute"}</button>
            <button type="button" aria-pressed={ducking} onClick={() => setDucking(!ducking)} className={`btn px-4 py-2 text-sm ${ducking ? "btn-gold" : "btn-ghost"}`}>Talk-over duck</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Knob label="Mic gain" value={gain} min={0} max={3} onChange={setGain} tone="ncvr-range-live" />
            <Knob label="Duck depth" value={duckLevel} min={0} max={1} onChange={setDuckLevel} tone="ncvr-range-gold" />
            <Knob label="Echo" value={echo} min={0} max={0.8} onChange={setEcho} />
            <Knob label="Reverb" value={reverb} min={0} max={1} onChange={setReverb} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} className="accent-[var(--color-gold)]" />
            Hear my mic in the local monitor (headphones only — speakers will feed back)
          </label>
          {err && <p className="text-xs text-red-300">{err}</p>}
          <p className="text-[10px] text-[var(--color-muted)]">MIC ON places your voice on the program bus. It is heard by listeners only while the transmitter is ON AIR.</p>
        </div>
        <MeterBar meter={meter} label="MIC" tone="live" />
      </div>
    </section>
  );
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];

function PadBank({ engine, library }: { engine: MixEngine; library: LibraryTrack[] }) {
  const [names, setNames] = useState<Record<number, string>>({});
  const [flash, setFlash] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const jingles = library.filter((t) => ["STATION_IDS", "SOUND_EFFECTS", "COMMERCIALS"].includes(t.category));

  const fire = useCallback((i: number) => {
    if (engine.firePad(i)) { setFlash(i); setTimeout(() => setFlash(null), 180); }
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = PAD_KEYS.indexOf(e.key);
      if (i >= 0) fire(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  async function load(i: number, src: File | string, name: string) {
    setErr(null);
    try { await engine.loadPad(i, src, name); setNames((n) => ({ ...n, [i]: name })); } catch (e) { setErr(`Pad ${i + 1}: ${(e as Error).message}`); }
  }

  return (
    <section className="glass p-4" aria-label="Sound pads">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">PADS · IDs · JINGLES · FX</div>
        <span className="font-mono text-[10px] text-[var(--color-muted)]">Keys 1–8</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PAD_KEYS.map((k, i) => (
          <div key={k} className="flex flex-col gap-1">
            <button type="button" disabled={!names[i]} onClick={() => fire(i)}
              className={`aspect-square rounded-xl border text-xs font-bold transition ${flash === i ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[var(--color-midnight)]" : names[i] ? "border-[var(--color-royal-400)] bg-[var(--color-royal)]/40 hover:bg-[var(--color-royal)]" : "border-dashed border-white/15 text-[var(--color-muted)]"}`}>
              <span className="block font-mono">{k}</span>
              <span className="line-clamp-2 px-1">{names[i] ?? "Empty"}</span>
            </button>
            <select aria-label={`Load pad ${k}`} className="field px-1 py-1 text-[10px]" defaultValue="" onChange={(e) => {
              const t = jingles.find((x) => x.id === e.target.value);
              if (t) load(i, `/api/studio/library/${t.id}/audio`, t.title);
              e.target.value = "";
            }}>
              <option value="">Library…</option>
              {jingles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <label className="cursor-pointer text-center text-[10px] text-[var(--color-muted)] hover:text-white">
              File…<input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(i, f, f.name.replace(/\.[^.]+$/, "")); }} />
            </label>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </section>
  );
}

function QueuePanel({ engine, library }: { engine: MixEngine; library: LibraryTrack[] }) {
  const [queue, setQueue] = useState<LibraryTrack[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  async function loadNext() {
    const next = queue[0];
    if (!next) return;
    const free = !engine.decks.A.playing ? engine.decks.A : !engine.decks.B.playing ? engine.decks.B : null;
    if (!free) return setMsg("Both decks are playing — stop one first.");
    await free.load(`/api/studio/library/${next.id}/audio`, { title: next.title, artist: next.artistName });
    setQueue((q) => q.slice(1));
    setMsg(`Loaded “${next.title}” to Deck ${free.id}.`);
  }
  return (
    <section className="glass p-4" aria-label="Music queue">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">QUEUE</div>
        <button type="button" className="btn btn-primary px-3 py-1 text-xs" disabled={!queue.length} onClick={loadNext}>Load next to free deck</button>
      </div>
      <select aria-label="Add track to queue" className="field text-sm" defaultValue="" onChange={(e) => {
        const t = library.find((x) => x.id === e.target.value);
        if (t) setQueue((q) => [...q, t]);
        e.target.value = "";
      }}>
        <option value="">Add approved track…</option>
        {library.map((t) => <option key={t.id} value={t.id}>{t.artistName} — {t.title}</option>)}
      </select>
      <ol className="mt-3 space-y-1">
        {queue.map((t, i) => (
          <li key={`${t.id}-${i}`} className="flex items-center justify-between rounded bg-black/30 px-2 py-1 text-sm">
            <span className="truncate">{i + 1}. {t.artistName} — {t.title}</span>
            <button type="button" className="text-xs text-[var(--color-muted)] hover:text-red-300" onClick={() => setQueue((q) => q.filter((_, j) => j !== i))} aria-label={`Remove ${t.title}`}>Remove</button>
          </li>
        ))}
        {queue.length === 0 && <li className="text-xs text-[var(--color-muted)]">Queue is empty.</li>}
      </ol>
      {msg && <p className="mt-2 text-xs text-[var(--color-gold)]">{msg}</p>}
    </section>
  );
}

function RecorderPanel({ engine }: { engine: MixEngine }) {
  const rec = useRef(new ProgramRecorder());
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed((Date.now() - (rec.current.startedAt ?? Date.now())) / 1000), 500);
    return () => clearInterval(id);
  }, [recording]);
  return (
    <section className="glass p-4" aria-label="Recorder">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">RECORD PROGRAM</div>
        {recording && <span className="font-mono text-sm text-[var(--color-live)]">● REC {fmtTime(elapsed)}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button type="button" className="btn btn-live px-4 py-1.5 text-sm" onClick={() => {
            const ok = engine.canRecord();
            if (!ok.ok) return setErr(ok.reason!);
            setErr(null);
            try { rec.current.start(engine.programOut.stream); setRecording(true); setElapsed(0); } catch (e) { setErr((e as Error).message); }
          }}>Start recording</button>
        ) : (
          <button type="button" className="btn btn-ghost px-4 py-1.5 text-sm" onClick={async () => {
            const blob = await rec.current.stop();
            setRecording(false);
            if (url) URL.revokeObjectURL(url);
            setUrl(URL.createObjectURL(blob));
          }}>Stop</button>
        )}
        {url && <a className="btn btn-gold px-4 py-1.5 text-sm" href={url} download={`ncvr-program-${new Date().toISOString().slice(0, 16)}.webm`}>Download recording</a>}
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      <p className="mt-2 text-[10px] text-[var(--color-muted)]">Records the transmitted program bus locally in this browser. Recording is blocked while an on-air guest has not consented.</p>
    </section>
  );
}

function TransmitPanel({ engine, webcastUrl, webDjUrl, canReturnToAutoDJ }: { engine: MixEngine } & ConsoleProps) {
  const { info, fetchError } = useBroadcast(4000);
  const [transport, setTransport] = useState<TransportState>("disconnected");
  const [tErr, setTErr] = useState<string | null>(null);
  const [url, setUrl] = useState(webcastUrl ?? "");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [bitrate, setBitrate] = useState(128000);
  const [msg, setMsg] = useState<string | null>(null);
  const caster = useRef<Webcaster | null>(null);
  if (!caster.current) caster.current = new Webcaster((s, e) => { setTransport(s); setTErr(e); });

  useEffect(() => () => caster.current?.disconnect(), []);

  // Push deck metadata when live
  useEffect(() => {
    if (transport !== "streaming") return;
    const id = setInterval(() => {
      const d = engine.decks.A.playing && engine.decks.A.xf.gain.value >= engine.decks.B.xf.gain.value ? engine.decks.A : engine.decks.B.playing ? engine.decks.B : null;
      if (d?.title) caster.current?.sendMetadata(d.title, d.artist);
    }, 15000);
    return () => clearInterval(id);
  }, [transport, engine]);

  const np = info?.nowPlaying;
  const onAir = deriveOnAir({ transport, engineLive: Boolean(np?.live.isLive), engineStreamer: np?.live.streamerName ?? null, ourStreamer: user || null });
  const lit = onAir === "ON_AIR";
  const amber = onAir === "UNCONFIRMED" || onAir === "CONNECTING";
  const mime = typeof window !== "undefined" ? Webcaster.supportedMime() : null;

  return (
    <section className="glass p-4" aria-label="Transmitter">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-center">
        <div role="status" aria-live="assertive"
          className={`grid h-24 min-w-56 place-items-center rounded-2xl border-2 px-6 font-[family-name:var(--font-display)] text-3xl font-black tracking-[0.3em] ${lit ? "onair-lit border-[var(--color-live)] bg-[var(--color-live)] text-white" : amber ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-gold)]" : onAir === "FAULT" ? "border-red-500 bg-red-600/20 text-red-300" : "border-white/15 bg-black/40 text-white/30"}`}>
          <div className="text-center">
            <div>{lit ? "ON AIR" : onAir === "FAULT" ? "FAULT" : amber ? "STANDBY" : "OFF AIR"}</div>
            <div className="mt-1 text-[10px] tracking-widest">{ON_AIR_LABEL[onAir]}</div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs sm:col-span-2"><span className="label">Webcast URL (AzuraCast Web DJ endpoint)</span>
            <input className="field font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="wss://…/webdj/ncvr/" disabled={transport !== "disconnected" && transport !== "error"} /></label>
          <label className="text-xs"><span className="label">DJ username</span>
            <input className="field text-sm" autoComplete="off" value={user} onChange={(e) => setUser(e.target.value)} disabled={transport !== "disconnected" && transport !== "error"} /></label>
          <label className="text-xs"><span className="label">DJ password</span>
            <input className="field text-sm" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} disabled={transport !== "disconnected" && transport !== "error"} /></label>
          <label className="text-xs"><span className="label">Bitrate</span>
            <select className="field text-sm" value={bitrate} onChange={(e) => setBitrate(Number(e.target.value))}>
              {[96000, 128000, 192000, 256000].map((b) => <option key={b} value={b}>{b / 1000} kbps</option>)}
            </select></label>
          <div className="text-xs text-[var(--color-muted)] sm:col-span-2 xl:col-span-3">
            Engine: {info?.configured ? (np ? (np.live.isLive ? <span className="text-[var(--color-live)]">LIVE — {np.live.streamerName}</span> : <span className="text-[var(--color-signal)]">AutoDJ</span>) : "no data") : "AzuraCast not configured"}
            {fetchError && <span className="text-red-300"> · {fetchError}</span>}
            {!mime && <span className="text-red-300"> · This browser cannot encode Opus for broadcasting.</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {transport === "disconnected" || transport === "error" ? (
            <ConfirmAction phrase="GO LIVE" label="Go live" className="btn btn-live" disabled={!url || !user || !pass || !mime}
              onConfirm={async () => { await engine.resume(); caster.current!.connect(url.trim(), user.trim(), pass, engine.programOut.stream, bitrate); }}>
              <p className="text-sm text-[var(--color-muted)]">Your program bus will be sent to the station. AzuraCast takes over from AutoDJ once it accepts your DJ login.</p>
            </ConfirmAction>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => caster.current!.disconnect()}>End broadcast → AutoDJ</button>
          )}
          {canReturnToAutoDJ && (
            <ConfirmAction phrase="RETURN TO AUTODJ" label="Force AutoDJ" className="btn btn-danger" disabled={!info?.adminConfigured}
              onConfirm={async () => {
                const r = await fetch("/api/studio/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "return-to-autodj", confirm: "RETURN TO AUTODJ" }) });
                const j = await r.json(); setMsg(j.message ?? j.error);
              }}>
              <p className="text-sm text-[var(--color-muted)]">Disconnects whichever DJ is live on the station (including other studios) and resumes scheduled AutoDJ programming.</p>
            </ConfirmAction>
          )}
          {webDjUrl && <a className="btn btn-ghost text-xs" href={webDjUrl} target="_blank" rel="noopener noreferrer">AzuraCast Web DJ (fallback)</a>}
        </div>
      </div>
      {tErr && <p className="mt-3 text-sm text-red-300">{tErr}</p>}
      {msg && <p className="mt-3 text-sm text-[var(--color-gold)]">{msg}</p>}
      {transport === "streaming" && onAir === "UNCONFIRMED" && <p className="mt-3 text-xs text-[var(--color-gold)]">Audio is being sent. Waiting for AzuraCast to report your live source (checked every few seconds)…</p>}
    </section>
  );
}
