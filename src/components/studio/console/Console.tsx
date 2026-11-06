"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MixEngine, type Meter, type MicInput } from "@/lib/audio/engine";
import { Webcaster } from "@/lib/audio/webcaster";
import { WavRecorder } from "@/lib/audio/wav";
import { findPrimaryMic } from "@/lib/audio/voice";
import { deriveOnAir, ON_AIR_LABEL, type TransportState } from "@/lib/audio/onair";
import { useBroadcast } from "../useBroadcast";
import { DeckPanel, type LibraryTrack } from "./DeckPanel";
import { ConfirmAction, Knob, MeterBar, fmtTime } from "./parts";
import { GuestPanel } from "./GuestPanel";
import { Emblem } from "../../brand/Logo";
import { PresetBar, PresetRegistryProvider, usePresetSlot } from "./presets";
import { padUrl, type PadSource } from "@/lib/console/preset";
import { MidiPanel } from "./MidiPanel";
import { acceptRange, reportControl, useConsoleControl } from "./controlBus";
import { VoicePanel } from "./VoicePanel";
import { scaleRange } from "@/lib/audio/midi";

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
  const [libReady, setLibReady] = useState(false);

  // Load approved library tracks for decks / pads / queue
  useEffect(() => {
    fetch("/api/studio/library?status=APPROVED").then(async (r) => {
      const j = await r.json();
      if (!r.ok) setLibErr(j.error); else setLibrary(j.tracks);
      setLibReady(true);
    }).catch((e) => { setLibErr(e.message); setLibReady(true); });
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
    <PresetRegistryProvider>
    <div className="space-y-4">
      <PresetBar ready={libReady} />
      <MidiPanel />
      <VoicePanel />
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
    </PresetRegistryProvider>
  );
}

function MasterSection({ engine, meters }: { engine: MixEngine; meters: Meters | null }) {
  const [xf, setXf] = useState(0.5);
  const [master, setMaster] = useState(0.9);
  const [monitor, setMonitor] = useState(0.7);
  const [cueVol, setCueVol] = useState(1);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [cueMsg, setCueMsg] = useState<string | null>(null);
  usePresetSlot("master", { crossfade: xf, master, monitor, cueVol }, (v) => {
    setXf(v.crossfade); setMaster(v.master); setMonitor(v.monitor);
    if (typeof v.cueVol === "number") setCueVol(v.cueVol);
  });
  useConsoleControl(["crossfader", "master", "cue"], (a) => {
    if (a.kind === "adjust" && a.target === "master") { setMaster((m) => Math.min(1.2, Math.max(0, m + a.delta))); return; }
    if (a.kind !== "range") return;
    if (a.force && a.target === "crossfader") { setXf(a.value); return; }
    if (a.target === "crossfader") { if (acceptRange(a.target, a.value, xf)) setXf(a.value); }
    else if (a.target === "cue.volume") { if (acceptRange(a.target, a.value, cueVol)) setCueVol(scaleRange("cue.volume", a.value)); }
    else if (acceptRange(a.target, a.value, master)) setMaster(scaleRange("master", a.value));
  });
  useEffect(() => { engine.cueBus.gain.value = cueVol; }, [engine, cueVol]);
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
        <div className="mt-2"><Knob label="Headphone volume" value={cueVol} min={0} max={1.5} onChange={setCueVol} /></div>
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
  const [deviceId, setDeviceId] = useState<string>("");
  const [input, setInput] = useState<MicInput>("both");
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [channels, setChannels] = useState(0);
  const [silentFor, setSilentFor] = useState(0);

  usePresetSlot("mic", { gain, ducking, duckLevel, echo, reverb, monitor, input, voiceProcessing }, (v) => {
    setGain(v.gain); setDucking(v.ducking); setDuckLevel(v.duckLevel); setEcho(v.echo); setReverb(v.reverb); setMonitor(v.monitor);
    if (v.input === "1" || v.input === "2" || v.input === "both") setInput(v.input);
    if (typeof v.voiceProcessing === "boolean") setVoiceProcessing(v.voiceProcessing);
  });

  // "No signal" helper: the mic is enabled but nothing reaches the meter.
  useEffect(() => {
    if (!enabled) { setSilentFor(0); return; }
    // -1 = signal seen since enabling (stop warning); otherwise count silent meter updates (~60 ms each)
    setSilentFor((s) => (s < 0 ? s : (meter?.peak ?? 0) > 0.002 ? -1 : s + 1));
  }, [enabled, meter]);

  useConsoleControl(["mic"], (a) => {
    if (a.target === "mic.gain" && a.kind === "range" && acceptRange(a.target, a.value, gain)) setGain(scaleRange("mic.gain", a.value));
    if (a.target === "mic.toggle" && a.kind === "button") { if (enabled) setOpen((o) => !o); else setErr("Enable the mic in the console first, then use the controller's mic button."); }
    if (a.target === "mic.mute" && a.kind === "button") setMuted((m) => !m);
    if (a.target === "mic.open") { if (enabled) setOpen(true); else reportControl("Enable the mic in the console first."); }
    if (a.target === "mic.close") setOpen(false);
    if (a.target === "mic.muteOn") setMuted(true);
    if (a.target === "mic.muteOff") setMuted(false);
  });

  const refreshDevices = useCallback(() => navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput"))), []);
  useEffect(() => { refreshDevices().catch(() => null); }, [refreshDevices]);
  useEffect(() => { engine.micGain.gain.value = gain; }, [engine, gain]);
  useEffect(() => { engine.setDucking(ducking, duckLevel); }, [engine, ducking, duckLevel]);
  useEffect(() => { engine.echoSend.gain.value = echo; }, [engine, echo]);
  useEffect(() => { engine.reverbSend.gain.value = reverb; }, [engine, reverb]);
  useEffect(() => { engine.micMonitor.gain.value = monitor ? 1 : 0; }, [engine, monitor]);
  useEffect(() => { engine.setMicOpen(open); }, [engine, open]);
  useEffect(() => { engine.setMicMuted(muted); }, [engine, muted]);

  async function enable(id: string = deviceId, opts: { input?: MicInput; voiceProcessing?: boolean; auto?: boolean } = {}) {
    setErr(null);
    try {
      const o = { input: opts.input ?? input, voiceProcessing: opts.voiceProcessing ?? voiceProcessing };
      await engine.enableMic(id || undefined, o);
      // No mic picked yet: use the Volt (the station's primary mic) when it's plugged in.
      // Device names are only visible after the first permission, hence the second step.
      if (!id && opts.auto) {
        const primary = findPrimaryMic(await navigator.mediaDevices.enumerateDevices());
        if (primary) { await engine.enableMic(primary.deviceId, o); id = primary.deviceId; }
      }
      setDeviceId(id); setEnabled(true); setChannels(engine.micChannels); setSilentFor(0); refreshDevices();
    }
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
            <select aria-label="Microphone device" className="field max-w-xs text-xs" onChange={(e) => enable(e.target.value)} value={deviceId}>
              <option value="">{enabled ? "Default microphone" : "Select microphone…"}</option>
              {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>)}
            </select>
            {!enabled && <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => enable(deviceId, { auto: true })}>Enable mic</button>}
          </div>
          {enabled && channels >= 2 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="label mb-0">Interface input</span>
              {([["1", "Input 1"], ["2", "Input 2"], ["both", "Both"]] as const).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={input === v} onClick={() => { setInput(v); enable(deviceId, { input: v }); }}
                  className={`btn px-2.5 py-1 text-[11px] ${input === v ? "btn-gold" : "btn-ghost"}`}>{l}</button>
              ))}
            </div>
          )}
          {enabled && (
            <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <input type="checkbox" checked={voiceProcessing} className="accent-[var(--color-gold)]"
                onChange={(e) => { setVoiceProcessing(e.target.checked); enable(deviceId, { voiceProcessing: e.target.checked }); }} />
              Noise suppression (only for a laptop mic in a noisy room — leave off for an audio interface; it makes voices choppy)
            </label>
          )}
          {enabled && silentFor > 80 && (
            <p role="status" className="rounded-lg border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 p-2 text-xs">
              No sound is reaching the mic meter. Check: the right device is selected above (e.g. <strong>Volt 2</strong>); the mic is in the input you picked;
              the interface&apos;s gain knob is turned up; <strong>48V</strong> is on for a condenser mic; and Windows Settings → Sound → Input shows the level moving.
            </p>
          )}
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
            Hear my mic in the local monitor while MIC ON (headphones only — speakers will feed back)
          </label>
          <p className="text-[10px] text-[var(--color-muted)]">
            Using a Volt 2 or similar interface? For zero-delay mic monitoring turn on its <strong>MONITOR</strong> switch / knob and keep this box off —
            your headphones then hear the mic directly from the interface.
          </p>
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
  const [sources, setSources] = useState<Record<number, PadSource>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const jingles = library.filter((t) => ["STATION_IDS", "SOUND_EFFECTS", "COMMERCIALS"].includes(t.category));

  const fire = useCallback((i: number) => {
    if (engine.firePad(i)) { setFlash(i); setTimeout(() => setFlash(null), 180); }
  }, [engine]);

  useConsoleControl(PAD_KEYS.map((_, i) => `pad${i + 1}`), (a) => {
    if (a.kind === "button") fire(Number(a.target.slice(3)) - 1);
  });

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

  async function load(i: number, src: File | string, name: string, source?: PadSource) {
    setErr(null);
    try {
      await engine.loadPad(i, src, name);
      setNames((n) => ({ ...n, [i]: name }));
      if (source) setSources((s) => ({ ...s, [i]: source }));
    } catch (e) { setErr(`Pad ${i + 1}: ${(e as Error).message}`); }
  }

  /** Local files are stored on the server so this pad can be restored by a preset. */
  async function loadLocal(i: number, f: File) {
    const name = f.name.replace(/\.[^.]+$/, "");
    await load(i, f, name);
    setSaving(i);
    const fd = new FormData(); fd.append("file", f); fd.append("name", name);
    const r = await fetch("/api/studio/console/pads", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setSaving(null);
    if (r.ok) setSources((s) => ({ ...s, [i]: { source: "pad", id: j.pad.id, name } }));
    else setErr(`Pad ${i + 1} plays now but won't be saved in presets: ${j.error ?? "upload failed"}`);
  }

  usePresetSlot("pads", PAD_KEYS.map((_, i) => sources[i] ?? null), async (list) => {
    await Promise.all(list.map((p, i) => (p ? load(i, padUrl(p), p.name, p) : Promise.resolve())));
  });

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
              if (t) load(i, `/api/studio/library/${t.id}/audio`, t.title, { source: "library", id: t.id, name: t.title });
              e.target.value = "";
            }}>
              <option value="">Library…</option>
              {jingles.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <label className="cursor-pointer text-center text-[10px] text-[var(--color-muted)] hover:text-white">
              {saving === i ? "Saving…" : "File…"}<input type="file" accept="audio/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadLocal(i, f); }} />
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
  usePresetSlot("queue", queue.map((t) => t.id), (ids) => {
    setQueue(ids.map((id) => library.find((t) => t.id === id)).filter((t): t is LibraryTrack => Boolean(t)));
  });
  const [msg, setMsg] = useState<string | null>(null);
  useConsoleControl(["deckA.load", "deckB.load"], async (a) => {
    if (a.kind !== "button") return;
    const next = queue[0];
    const d = a.target.startsWith("deckA") ? engine.decks.A : engine.decks.B;
    if (!next) { reportControl("The queue is empty."); return setMsg("Queue is empty — add tracks to load from the controller."); }
    if (d.playing) return setMsg(`Deck ${d.id} is playing — stop it before loading.`);
    await d.load(`/api/studio/library/${next.id}/audio`, { title: next.title, artist: next.artistName });
    setQueue((q) => q.slice(1));
    setMsg(`Loaded “${next.title}” to Deck ${d.id}.`);
  });

  useConsoleControl(["queue.next"], () => { loadNext(); });

  async function loadNext() {
    const next = queue[0];
    if (!next) { reportControl("The queue is empty."); return; }
    const free = !engine.decks.A.playing ? engine.decks.A : !engine.decks.B.playing ? engine.decks.B : null;
    if (!free) { reportControl("Both decks are playing — stop one first."); return setMsg("Both decks are playing — stop one first."); }
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
  const rec = useRef<WavRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mb, setMb] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("ncvr-program.wav");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - (rec.current?.startedAt ?? Date.now())) / 1000);
      setMb((rec.current?.bytes ?? 0) / 1e6);
    }, 500);
    return () => clearInterval(id);
  }, [recording]);
  async function startRec() {
    if (recording) return;
    const ok = engine.canRecord();
    if (!ok.ok) { reportControl(ok.reason!); return setErr(ok.reason!); }
    setErr(null);
    const tap = await engine.tapReady;
    if (!tap) return setErr("This browser can't record WAV (no AudioWorklet). Use Chrome or Edge.");
    await engine.resume();
    if (!rec.current) rec.current = new WavRecorder(tap, engine.ctx.sampleRate, () => { setErr("Reached the 4 GB WAV limit — recording stopped and saved."); stopRec(); });
    rec.current.start();
    setFileName(`ncvr-program-${new Date().toISOString().slice(0, 16).replace(":", "-")}.wav`);
    setRecording(true); setElapsed(0); setMb(0);
  }
  async function stopRec() {
    if (!rec.current?.recording) return;
    setSaving(true);
    const blob = await rec.current.stop();
    setRecording(false); setSaving(false);
    setMb(blob.size / 1e6);
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(blob));
  }
  useConsoleControl(["record"], (a) => { if (a.target === "record.start") startRec(); else if (a.target === "record.stop") stopRec(); });
  return (
    <section className="glass p-4" aria-label="Recorder">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-display)] text-sm font-bold tracking-widest">RECORD PROGRAM</div>
        {recording && <span className="font-mono text-sm text-[var(--color-live)]">● REC {fmtTime(elapsed)} · {mb.toFixed(1)} MB</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {!recording ? (
          <button type="button" className="btn btn-live px-4 py-1.5 text-sm" onClick={startRec}>Start recording</button>
        ) : (
          <button type="button" className="btn btn-ghost px-4 py-1.5 text-sm" disabled={saving} onClick={stopRec}>{saving ? "Saving…" : "Stop"}</button>
        )}
        {url && !recording && <a className="btn btn-gold px-4 py-1.5 text-sm" href={url} download={fileName}>Download WAV ({mb.toFixed(1)} MB)</a>}
      </div>
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
      <p className="mt-2 text-[10px] text-[var(--color-muted)]">Records exactly what is transmitted (the master program bus) as an uncompressed 16-bit stereo WAV, about 690 MB per hour. Download it before closing the page. Recording is blocked while an on-air guest has not consented.</p>
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
  usePresetSlot("transmit", { url, user, bitrate }, (v) => {
    if (v.url) setUrl(v.url);
    if (v.user) setUser(v.user);
    if (v.bitrate) setBitrate(v.bitrate);
  });
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

  async function goLive() { await engine.resume(); caster.current!.connect(url.trim(), user.trim(), pass, engine.programOut.stream, bitrate); }
  // Voice: the voice panel has already asked for and heard “confirm”.
  useConsoleControl(["transmit"], (a) => {
    if (a.target === "transmit.golive") {
      if (transport !== "disconnected" && transport !== "error") return reportControl("You're already connected.");
      if (!url || !user || !pass) return reportControl("Type your DJ username and password in the transmitter first.");
      if (!mime) return reportControl("This browser can't broadcast — use Chrome or Edge.");
      goLive();
    } else if (a.target === "transmit.end") {
      if (transport === "disconnected") return reportControl("You're not live.");
      caster.current!.disconnect();
    }
  });

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
              onConfirm={goLive}>
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
