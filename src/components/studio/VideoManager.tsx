"use client";
import { useEffect, useState } from "react";
import { Badge } from "../ui/Panel";
import { fmtTime } from "./console/parts";
import { DAY_SHORT, formatMinute } from "@/lib/schedule";

import { BlockEditor, ScreenLookPanel, type BlockFull, type LookSettings } from "./TvLook";

type Kind = "MUSIC_VIDEO" | "CARTOON" | "PROGRAM" | "MOVIE" | "COMMERCIAL";
const KINDS: Array<[Kind, string, string]> = [
  ["MUSIC_VIDEO", "Music videos", "Artist"],
  ["CARTOON", "Cartoons", "Series / creator"],
  ["PROGRAM", "Shows", "Series / host"],
  ["MOVIE", "Movies", "Studio / director"],
  ["COMMERCIAL", "Commercials", "Advertiser"],
];
interface V { id: string; kind: Kind; title: string; artistName: string; advertiser: string | null; durationSec: number; status: string; sortOrder: number; fileSize: number; startsOn: string | null; endsOn: string | null; weight: number }
interface Live { configured: boolean; live: boolean; hlsUrl: string | null; error?: string }
interface Settings extends LookSettings { enabled: boolean; breakEvery: number; breakSeconds: number }
type Block = BlockFull & { kind: Kind };

const TIMES = Array.from({ length: 49 }, (_, i) => i * 30);
const json = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function VideoManager() {
  const [videos, setVideos] = useState<V[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [rtmp, setRtmp] = useState<{ url: string | null; path: string }>({ url: null, path: "live" });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tab, setTab] = useState<Kind>("MUSIC_VIDEO");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadKind, setUploadKind] = useState<Kind>("MUSIC_VIDEO");

  const load = async () => {
    const r = await fetch("/api/studio/videos");
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setVideos(j.videos); setLive(j.live); setRtmp({ url: j.rtmpUrl, path: j.path }); setBlocks(j.blocks);
    setSettings((s) => s ?? j.settings);
  };
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);
  useEffect(() => { setUploadKind(tab); }, [tab]);

  async function act(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/studio/videos/${id}`, json("PATCH", body));
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...j.video } : v)).sort((a, b) => a.sortOrder - b.sortOrder));
  }
  const list = videos.filter((v) => v.kind === tab);
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    act(a.id, { action: "update", sortOrder: b.sortOrder });
    act(b.id, { action: "update", sortOrder: a.sortOrder === b.sortOrder ? a.sortOrder + dir : a.sortOrder });
  }

  function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("video") as File;
    if (!file?.size) return;
    setBusy(true); setMsg(null);
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      fd.set("durationSec", String(Math.round(probe.duration || 0)));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/studio/videos");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => {
        setBusy(false); setProgress(null);
        const j = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 400) return setMsg({ tone: "err", text: j.error ?? `Upload failed (${xhr.status})` });
        form.reset(); setTab(j.video.kind);
        setMsg({ tone: "ok", text: `Uploaded “${j.video.title}”. Click “Put on air” to use it.` }); load();
      };
      xhr.onerror = () => { setBusy(false); setProgress(null); setMsg({ tone: "err", text: "Network error during upload" }); };
      xhr.send(fd);
    };
    probe.onerror = () => { URL.revokeObjectURL(url); setBusy(false); setMsg({ tone: "err", text: "This browser can't read that video. Use MP4 (H.264 + AAC) or WebM." }); };
    probe.src = url;
  }

  async function saveSettings() {
    if (!settings) return;
    const r = await fetch("/api/studio/tv/settings", json("PUT", { enabled: settings.enabled, breakEvery: settings.breakEvery, breakSeconds: settings.breakSeconds }));
    const j = await r.json();
    setMsg(r.ok ? { tone: "ok", text: "Commercial break settings saved — NCVR TV uses them immediately." } : { tone: "err", text: j.error });
  }

  const onAir = (k: Kind) => videos.filter((v) => v.kind === k && v.status === "APPROVED");
  const spots = onAir("COMMERCIAL");
  const tooLong = spots.filter((s) => settings && s.durationSec > settings.breakSeconds);
  const ownerLabel = KINDS.find(([k]) => k === uploadKind)?.[2] ?? "Artist";

  return (
    <div className="space-y-4">
      {/* Live + rotation summary */}
      <section className="glass grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <div className="kicker">Live video feed</div>
          <div className="mt-2 flex items-center gap-2">
            {!live?.configured ? <Badge tone="muted">Not set up</Badge> : live.live ? <Badge tone="live">● LIVE on NCVR TV</Badge> : <Badge tone="signal">Ready — not live</Badge>}
            {live?.error && <span className="text-xs text-red-300">{live.error}</span>}
          </div>
          {live?.configured ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>Go live from <strong>OBS Studio</strong> → Settings → Stream:</p>
              <ul className="space-y-0.5 font-mono text-xs">
                <li>Service: <span className="text-[var(--color-gold)]">Custom…</span></li>
                <li>Server: <span className="text-[var(--color-gold)]">{rtmp.url ?? "rtmp://stream.nitecapviberadio.tech:1935"}</span></li>
                <li>Stream key: <span className="text-[var(--color-gold)]">{rtmp.path}?user=ncvr&amp;pass=YOUR-LIVE-PASSWORD</span></li>
              </ul>
            </div>
          ) : <p className="mt-2 text-sm text-[var(--color-muted)]">Live video needs MediaMTX (docs/DEPLOYMENT.md → 5b). Everything else on this page works without it.</p>}
        </div>
        <div>
          <div className="kicker">On air now</div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {KINDS.map(([k, l]) => <li key={k}>{l}: <strong>{onAir(k).length}</strong> {k !== "COMMERCIAL" && <span className="text-xs text-[var(--color-muted)]">· {fmtTime(onAir(k).reduce((n, v) => n + v.durationSec, 0))} loop</span>}</li>)}
          </ul>
          <a href="/radio/tv" target="_blank" className="btn btn-ghost mt-3 text-xs">Open NCVR TV ↗</a>
        </div>
      </section>

      {/* Commercial breaks */}
      <section className="glass p-4" aria-label="Commercial breaks">
        <div className="kicker">Commercial breaks</div>
        {settings && (
          <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="accent-[var(--color-gold)]" />Commercial breaks on</label>
            <label className="text-xs"><span className="label">Break after every</span>
              <select className="field w-auto" value={settings.breakEvery} onChange={(e) => setSettings({ ...settings, breakEvery: Number(e.target.value) })}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} video{n > 1 ? "s" : ""}</option>)}
              </select></label>
            <label className="text-xs"><span className="label">Break length</span>
              <select className="field w-auto" value={settings.breakSeconds} onChange={(e) => setSettings({ ...settings, breakSeconds: Number(e.target.value) })}>
                {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((n) => <option key={n} value={n}>{n >= 60 ? `${n / 60} min` : `${n} s`}</option>)}
              </select></label>
            <button type="button" className="btn btn-primary px-4 py-1.5 text-sm" onClick={saveSettings}>Save break settings</button>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Each break picks commercials at random (weighted, no repeats in a break) and fills leftover time with an NCVR TV &ldquo;We&apos;ll be right back&rdquo; bumper.
          All viewers see the same break at the same time. Commercials are labelled &ldquo;Advertisement&rdquo; on screen. Breaks can be switched off per schedule block.
        </p>
        {settings?.enabled && spots.length === 0 && <p className="mt-1 text-xs text-[var(--color-gold)]">No commercials on air yet — breaks are skipped until you add some.</p>}
        {tooLong.length > 0 && <p className="mt-1 text-xs text-[var(--color-gold)]">Longer than a break and never shown: {tooLong.map((s) => s.title).join(", ")}. Lengthen breaks or trim the spot.</p>}
      </section>

      {settings && <ScreenLookPanel initial={settings} onMsg={setMsg} />}

      {/* TV schedule */}
      <BlocksPanel blocks={blocks} videos={videos} channel={{ breakEvery: settings?.breakEvery ?? 3, breakSeconds: settings?.breakSeconds ?? 90 }} onChange={load} setMsg={setMsg} />

      {/* Upload */}
      <form onSubmit={upload} className="glass grid gap-3 p-4 md:grid-cols-4">
        <div className="kicker md:col-span-4">Upload video</div>
        <label className="text-xs"><span className="label">Type *</span>
          <select name="kind" className="field" value={uploadKind} onChange={(e) => setUploadKind(e.target.value as Kind)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l.replace(/s$/, "")}</option>)}
          </select></label>
        <label className="text-xs"><span className="label">{ownerLabel} *</span><input name="artistName" required defaultValue={uploadKind === "MUSIC_VIDEO" ? "Caprio Jackson" : ""} key={uploadKind} className="field" /></label>
        <label className="text-xs md:col-span-2"><span className="label">{uploadKind === "COMMERCIAL" ? "Spot name *" : uploadKind === "MUSIC_VIDEO" ? "Song title *" : "Episode title *"}</span><input name="title" required className="field" /></label>
        {uploadKind === "COMMERCIAL" && (
          <>
            <label className="text-xs"><span className="label">Runs from</span><input name="startsOn" type="date" className="field" /></label>
            <label className="text-xs"><span className="label">Runs until</span><input name="endsOn" type="date" className="field" /></label>
            <label className="text-xs"><span className="label">How often (weight)</span>
              <select name="weight" className="field" defaultValue="1">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "1 (normal)" : `${n}× more often`}</option>)}</select></label>
            <p className="self-end text-[10px] text-[var(--color-muted)]">Leave dates empty to run indefinitely.</p>
          </>
        )}
        <label className="text-xs md:col-span-2"><span className="label">Video file * (MP4 H.264/AAC or WebM)</span><input name="video" type="file" required accept="video/mp4,video/webm,.mp4,.m4v,.mov,.webm" className="field" /></label>
        <label className="text-xs"><span className="label">Thumbnail (optional)</span><input name="poster" type="file" accept="image/*" className="field" /></label>
        <div className="flex items-end"><button className="btn btn-primary w-full" disabled={busy}>{busy ? (progress != null ? `Uploading ${progress}%` : "Reading video…") : "Upload"}</button></div>
        <label className="flex items-center gap-2 text-xs md:col-span-4"><input type="checkbox" name="rightsConfirmed" required className="accent-[var(--color-gold)]" />
          {uploadKind === "COMMERCIAL" ? "The advertiser approved this spot and I have the rights to air it (music, footage, logos) *" : "I own this video or have written permission to broadcast it (music + visuals) *"}</label>
      </form>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm ${msg.tone === "err" ? "text-red-300" : "text-[var(--color-signal)]"}`}>{msg.text}</p>}
      {preview && <video src={`/api/studio/videos/${preview}/file`} controls autoPlay className="w-full max-w-2xl rounded-xl" onEnded={() => setPreview(null)} />}

      {/* Library by type */}
      <nav className="flex flex-wrap gap-2" aria-label="Video type">
        {KINDS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`btn px-3 py-1.5 text-xs ${tab === k ? "btn-primary" : "btn-ghost"}`}>
            {l} <span className="opacity-70">({videos.filter((v) => v.kind === k).length})</span>
          </button>
        ))}
      </nav>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">{tab === "COMMERCIAL" ? "" : "Order"}</th><th>{tab === "COMMERCIAL" ? "Commercial" : "Video"}</th><th>Length</th><th>Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {list.map((v, i) => (
              <tr key={v.id} className="border-t border-white/5">
                <td className="p-3">{tab !== "COMMERCIAL" && <>
                  <button type="button" aria-label={`Move ${v.title} up`} className="px-1 text-[var(--color-muted)] hover:text-white" onClick={() => move(i, -1)}>▲</button>
                  <button type="button" aria-label={`Move ${v.title} down`} className="px-1 text-[var(--color-muted)] hover:text-white" onClick={() => move(i, 1)}>▼</button></>}
                </td>
                <td className="py-3">
                  <div className="font-semibold">{v.title}</div>
                  <div className="text-xs text-[var(--color-muted)]">{v.kind === "COMMERCIAL" ? v.advertiser ?? v.artistName : v.artistName} · {(v.fileSize / 1048576).toFixed(0)} MB
                    {v.kind === "COMMERCIAL" && <> · weight {v.weight}{v.startsOn || v.endsOn ? ` · ${v.startsOn ? new Date(v.startsOn).toLocaleDateString() : "…"} → ${v.endsOn ? new Date(v.endsOn).toLocaleDateString() : "…"}` : ""}</>}
                  </div>
                </td>
                <td className="font-mono text-xs">{fmtTime(v.durationSec)}</td>
                <td><Badge tone={v.status === "APPROVED" ? "signal" : v.status === "PENDING_REVIEW" ? "gold" : "muted"}>{v.status === "APPROVED" ? "On air" : v.status.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="space-x-1 p-3">
                  <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => setPreview(preview === v.id ? null : v.id)}>{preview === v.id ? "Close" : "Preview"}</button>
                  {v.status !== "APPROVED" && <button type="button" className="btn btn-primary px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "approve" })}>Put on air</button>}
                  {v.status === "APPROVED" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "archive" })}>Take off air</button>}
                  {v.status === "PENDING_REVIEW" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "reject" })}>Reject</button>}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-[var(--color-muted)]">Nothing here yet — upload above.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">Only air videos you own or have written permission to broadcast. Classic cartoons are usually still under copyright — see the guide in docs/NCVR-TV-CONTENT.md.</p>
    </div>
  );
}

function BlocksPanel({ blocks, videos, channel, onChange, setMsg }: { blocks: Block[]; videos: V[]; channel: { breakEvery: number; breakSeconds: number }; onChange: () => void; setMsg: (m: { tone: "ok" | "err"; text: string }) => void }) {
  const [draft, setDraft] = useState<{ title: string; days: number[]; startMinute: number; endMinute: number; kind: Kind; commercials: boolean; active: boolean }>({ title: "", days: [7], startMinute: 540, endMinute: 660, kind: "CARTOON", commercials: true, active: true });
  const [editing, setEditing] = useState<string | null>(null);
  async function save(id: string | null, body: Partial<Block> | typeof draft) {
    const r = await fetch(id ? `/api/studio/tv/blocks/${id}` : "/api/studio/tv/blocks", json(id ? "PATCH" : "POST", body));
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setMsg({ tone: "ok", text: id ? "Schedule updated." : `Added “${j.block.title}” to the NCVR TV schedule.` });
    onChange();
  }
  async function remove(b: Block) {
    if (!window.confirm(`Delete “${b.title}” from the TV schedule?`)) return;
    const r = await fetch(`/api/studio/tv/blocks/${b.id}`, { method: "DELETE" });
    if (r.ok) onChange();
  }
  const kindLabel = (k: Kind) => KINDS.find(([x]) => x === k)?.[1] ?? k;
  return (
    <section className="glass p-4" aria-label="TV schedule">
      <div className="kicker">NCVR TV schedule (Eastern Time)</div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">Outside these blocks NCVR TV plays the music-video rotation. If a block has nothing on air yet, music videos play instead.</p>
      <ul className="mt-3 space-y-2">
        {blocks.map((b) => (
          <li key={b.id} className={`rounded-xl border p-3 text-sm ${b.active ? "border-[var(--color-gold)]/40" : "border-white/10 opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.logoPath && <img src={b.logoPath} alt="" className="h-10 w-auto" />}
            <strong className="min-w-48">{b.title}</strong>
            <span className="font-mono text-xs">{b.days.map((d) => DAY_SHORT[d]).join(", ")} · {formatMinute(b.startMinute)}–{b.endMinute === 1440 ? "12 AM" : formatMinute(b.endMinute)}</span>
            <Badge tone="royal">{kindLabel(b.kind)}</Badge>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={b.commercials} onChange={(e) => save(b.id, { commercials: e.target.checked })} className="accent-[var(--color-gold)]" />Commercials</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={b.active} onChange={(e) => save(b.id, { active: e.target.checked })} className="accent-[var(--color-gold)]" />Active</label>
            {b.featureVideoId && <Badge tone="gold">Feature {b.featureStartMinute != null ? formatMinute(b.featureStartMinute) : ""}{b.featureDate ? ` · ${b.featureDate}` : " · weekly"}</Badge>}
            <button type="button" className="btn btn-ghost ml-auto px-3 py-1 text-xs" aria-expanded={editing === b.id} onClick={() => setEditing(editing === b.id ? null : b.id)}>{editing === b.id ? "Close" : "Edit"}</button>
            <button type="button" className="text-xs text-red-300 hover:underline" onClick={() => remove(b)}>Delete</button>
            </div>
            {editing === b.id && <BlockEditor block={b} videos={videos} channel={channel} onSaved={onChange} onMsg={setMsg} />}
          </li>
        ))}
      </ul>
      <form className="mt-4 grid gap-2 rounded-xl border border-dashed border-white/15 p-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); save(null, draft); }}>
        <label className="text-xs md:col-span-2"><span className="label">New block</span><input className="field" required placeholder="e.g. Sunday Cartoon Classics" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="text-xs"><span className="label">Plays</span>
          <select className="field" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}>
            {KINDS.filter(([k]) => k !== "COMMERCIAL").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label className="text-xs"><span className="label">From</span>
          <select className="field" value={draft.startMinute} onChange={(e) => setDraft({ ...draft, startMinute: Number(e.target.value) })}>{TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{formatMinute(t)}</option>)}</select></label>
        <label className="text-xs"><span className="label">To</span>
          <select className="field" value={draft.endMinute} onChange={(e) => setDraft({ ...draft, endMinute: Number(e.target.value) })}>{TIMES.slice(1).map((t) => <option key={t} value={t}>{t === 1440 ? "Midnight" : formatMinute(t)}</option>)}</select></label>
        <div className="flex items-end"><button className="btn btn-primary w-full py-2 text-xs">Add block</button></div>
        <fieldset className="flex flex-wrap gap-2 md:col-span-6">
          <legend className="sr-only">Days</legend>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={draft.days.includes(d)} className="accent-[var(--color-gold)]"
                onChange={(e) => setDraft({ ...draft, days: e.target.checked ? [...draft.days, d].sort() : draft.days.filter((x) => x !== d) })} />{DAY_SHORT[d]}
            </label>
          ))}
          <label className="ml-4 flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.commercials} onChange={(e) => setDraft({ ...draft, commercials: e.target.checked })} className="accent-[var(--color-gold)]" />Commercial breaks</label>
        </fieldset>
      </form>
    </section>
  );
}
