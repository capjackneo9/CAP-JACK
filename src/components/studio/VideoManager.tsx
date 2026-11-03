"use client";
import { useEffect, useState } from "react";
import { Badge } from "../ui/Panel";
import { fmtTime } from "./console/parts";

interface V { id: string; title: string; artistName: string; durationSec: number; status: string; sortOrder: number; fileSize: number }
interface Live { configured: boolean; live: boolean; hlsUrl: string | null; error?: string }

export function VideoManager() {
  const [videos, setVideos] = useState<V[]>([]);
  const [live, setLive] = useState<Live | null>(null);
  const [rtmp, setRtmp] = useState<{ url: string | null; path: string }>({ url: null, path: "live" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = async () => {
    const r = await fetch("/api/studio/videos");
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setVideos(j.videos); setLive(j.live); setRtmp({ url: j.rtmpUrl, path: j.path });
  };
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);

  async function act(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/studio/videos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...j.video } : v)).sort((a, b) => a.sortOrder - b.sortOrder));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= videos.length) return;
    const a = videos[i], b = videos[j];
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
    // Measure duration in the browser — the TV clock needs it.
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      fd.set("durationSec", String(Math.round(probe.duration || 0)));
      const xhr = new XMLHttpRequest(); // XHR for upload progress on big files
      xhr.open("POST", "/api/studio/videos");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => {
        setBusy(false); setProgress(null);
        const j = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 400) return setMsg({ tone: "err", text: j.error ?? `Upload failed (${xhr.status})` });
        form.reset(); setMsg({ tone: "ok", text: `Uploaded “${j.video.title}”. Approve it to put it in rotation.` }); load();
      };
      xhr.onerror = () => { setBusy(false); setProgress(null); setMsg({ tone: "err", text: "Network error during upload" }); };
      xhr.send(fd);
    };
    probe.onerror = () => { URL.revokeObjectURL(url); setBusy(false); setMsg({ tone: "err", text: "This browser can't read that video. Use MP4 (H.264 + AAC) or WebM." }); };
    probe.src = url;
  }

  const inRotation = videos.filter((v) => v.status === "APPROVED");
  const cycle = inRotation.reduce((s, v) => s + v.durationSec, 0);

  return (
    <div className="space-y-4">
      <section className="glass grid gap-4 p-4 lg:grid-cols-2">
        <div>
          <div className="kicker">Live video feed</div>
          <div className="mt-2 flex items-center gap-2">
            {!live?.configured ? <Badge tone="muted">Not set up</Badge> : live.live ? <Badge tone="live">● LIVE on NCVR TV</Badge> : <Badge tone="signal">Ready — not live</Badge>}
            {live?.error && <span className="text-xs text-red-300">{live.error}</span>}
          </div>
          {live?.configured ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>To go live on camera, use <strong>OBS Studio</strong> → Settings → Stream:</p>
              <ul className="space-y-0.5 font-mono text-xs">
                <li>Service: <span className="text-[var(--color-gold)]">Custom…</span></li>
                <li>Server: <span className="text-[var(--color-gold)]">{rtmp.url ?? "rtmp://stream.nitecapviberadio.tech:1935"}</span></li>
                <li>Stream key: <span className="text-[var(--color-gold)]">{rtmp.path}?user=ncvr&amp;pass=YOUR-LIVE-PASSWORD</span></li>
              </ul>
              <p className="text-xs text-[var(--color-muted)]">NCVR TV switches to your feed within ~20 seconds of going live and back to the video rotation when you stop. Video carries its own audio; the radio stream keeps running separately.</p>
            </div>
          ) : <p className="mt-2 text-sm text-[var(--color-muted)]">Live video needs the MediaMTX service (see docs/DEPLOYMENT.md → NCVR TV). The music-video rotation works without it.</p>}
        </div>
        <div>
          <div className="kicker">Rotation</div>
          <p className="mt-2 text-sm">{inRotation.length} video(s) in rotation · loop length {fmtTime(cycle)}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Every viewer sees the same video at the same moment, like a TV channel. Order below = play order.</p>
          <a href="/radio/tv" target="_blank" className="btn btn-ghost mt-3 text-xs">Open NCVR TV ↗</a>
        </div>
      </section>

      <form onSubmit={upload} className="glass grid gap-3 p-4 md:grid-cols-4">
        <div className="kicker md:col-span-4">Upload music video</div>
        <label className="text-xs"><span className="label">Artist *</span><input name="artistName" required defaultValue="Caprio Jackson" className="field" /></label>
        <label className="text-xs"><span className="label">Title *</span><input name="title" required className="field" /></label>
        <label className="text-xs md:col-span-2"><span className="label">Video file * (MP4 H.264/AAC or WebM)</span><input name="video" type="file" required accept="video/mp4,video/webm,.mp4,.m4v,.mov,.webm" className="field" /></label>
        <label className="text-xs"><span className="label">Thumbnail (optional)</span><input name="poster" type="file" accept="image/*" className="field" /></label>
        <label className="flex items-center gap-2 text-xs md:col-span-2"><input type="checkbox" name="rightsConfirmed" required className="accent-[var(--color-gold)]" />I have the rights to broadcast this video (music + visuals) *</label>
        <div className="flex items-end"><button className="btn btn-primary w-full" disabled={busy}>{busy ? (progress != null ? `Uploading ${progress}%` : "Reading video…") : "Upload"}</button></div>
      </form>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm ${msg.tone === "err" ? "text-red-300" : "text-[var(--color-signal)]"}`}>{msg.text}</p>}
      {preview && <video src={`/api/studio/videos/${preview}/file`} controls autoPlay className="w-full max-w-2xl rounded-xl" onEnded={() => setPreview(null)} />}

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">Order</th><th>Video</th><th>Length</th><th>Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {videos.map((v, i) => (
              <tr key={v.id} className="border-t border-white/5">
                <td className="p-3">
                  <button type="button" aria-label={`Move ${v.title} up`} className="px-1 text-[var(--color-muted)] hover:text-white" onClick={() => move(i, -1)}>▲</button>
                  <button type="button" aria-label={`Move ${v.title} down`} className="px-1 text-[var(--color-muted)] hover:text-white" onClick={() => move(i, 1)}>▼</button>
                </td>
                <td className="py-3"><div className="font-semibold">{v.title}</div><div className="text-xs text-[var(--color-muted)]">{v.artistName} · {(v.fileSize / 1048576).toFixed(0)} MB</div></td>
                <td className="font-mono text-xs">{fmtTime(v.durationSec)}</td>
                <td><Badge tone={v.status === "APPROVED" ? "signal" : v.status === "PENDING_REVIEW" ? "gold" : "muted"}>{v.status === "APPROVED" ? "In rotation" : v.status.replace("_", " ").toLowerCase()}</Badge></td>
                <td className="space-x-1 p-3">
                  <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => setPreview(preview === v.id ? null : v.id)}>{preview === v.id ? "Close" : "Preview"}</button>
                  {v.status !== "APPROVED" && <button type="button" className="btn btn-primary px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "approve" })}>Put in rotation</button>}
                  {v.status === "APPROVED" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "archive" })}>Remove from rotation</button>}
                  {v.status === "PENDING_REVIEW" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(v.id, { action: "reject" })}>Reject</button>}
                </td>
              </tr>
            ))}
            {videos.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-[var(--color-muted)]">No videos yet — upload your first music video above.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">Music videos carry both sound-recording and video rights. Only air videos you own or have written permission to broadcast.</p>
    </div>
  );
}
