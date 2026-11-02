"use client";
import { useState } from "react";
import { TRACK_CATEGORIES, CATEGORY_LABEL } from "@/lib/categories";
import { Badge } from "../../ui/Panel";

interface Track { id: string; title: string; artistName: string; category: string; status: string; genre: string | null; azuracastMediaId: number | null; playlists: string[]; createdAt: string; submissionId: string | null }

export function LibraryManager({ initial, canUpload, canApprove, playlists }: { initial: Track[]; canUpload: boolean; canApprove: boolean; playlists: Array<{ id: number; name: string }> | null }) {
  const [tracks, setTracks] = useState(initial);
  const [filter, setFilter] = useState({ status: "", category: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function act(id: string, body: Record<string, unknown>) {
    const r = await fetch(`/api/studio/library/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, ...j.track } : t)));
    setMsg({ tone: "ok", text: "Updated." });
  }

  const shown = tracks.filter((t) => (!filter.status || t.status === filter.status) && (!filter.category || t.category === filter.category));

  return (
    <div className="space-y-4">
      {canUpload && (
        <form className="glass grid gap-3 p-4 md:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          setUploading(true); setMsg(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          const audio = fd.get("audio") as File;
          // Read duration client-side for metadata
          try {
            const url = URL.createObjectURL(audio);
            const dur = await new Promise<number>((res) => { const a = new Audio(url); a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(0); });
            URL.revokeObjectURL(url);
            if (dur) fd.set("durationSec", String(Math.round(dur)));
          } catch { /* optional */ }
          const r = await fetch("/api/studio/library", { method: "POST", body: fd });
          const j = await r.json();
          setUploading(false);
          if (!r.ok) return setMsg({ tone: "err", text: j.error });
          setTracks([j.track, ...tracks]); form.reset();
          setMsg({ tone: "ok", text: `Uploaded “${j.track.title}”. It stays out of broadcast playlists until approved.` });
        }}>
          <div className="kicker md:col-span-4">Upload audio</div>
          <label className="text-xs"><span className="label">Title *</span><input name="title" required className="field" /></label>
          <label className="text-xs"><span className="label">Artist *</span><input name="artistName" required defaultValue="Caprio Jackson" className="field" /></label>
          <label className="text-xs"><span className="label">Category *</span>
            <select name="category" required className="field">{TRACK_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-xs"><span className="label">Genre</span><input name="genre" className="field" /></label>
          <label className="text-xs"><span className="label">Album / project</span><input name="album" className="field" /></label>
          <label className="text-xs"><span className="label">ISRC</span><input name="isrc" className="field" /></label>
          <label className="text-xs md:col-span-2"><span className="label">Credits</span><input name="credits" className="field" /></label>
          <label className="text-xs md:col-span-2"><span className="label">Audio file *</span><input name="audio" type="file" required accept="audio/*" className="field" /></label>
          <label className="text-xs"><span className="label">Artwork</span><input name="artwork" type="file" accept="image/*" className="field" /></label>
          <div className="flex flex-col justify-end gap-2 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" name="explicit" className="accent-[var(--color-gold)]" />Explicit</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="rightsConfirmed" required className="accent-[var(--color-gold)]" />Broadcast rights confirmed *</label>
          </div>
          <div className="md:col-span-4"><button className="btn btn-primary" disabled={uploading}>{uploading ? "Uploading & validating…" : "Upload"}</button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter by status" className="field w-auto text-sm" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All statuses</option>{["PENDING_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select aria-label="Filter by category" className="field w-auto text-sm" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">All categories</option>{TRACK_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="text-xs text-[var(--color-muted)]">{shown.length} tracks</span>
      </div>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm ${msg.tone === "err" ? "text-red-300" : "text-[var(--color-signal)]"}`}>{msg.text}</p>}
      {preview && <audio src={`/api/studio/library/${preview}/audio`} controls autoPlay className="w-full" onEnded={() => setPreview(null)} />}

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs uppercase text-[var(--color-muted)]"><tr><th className="p-3">Track</th><th>Category</th><th>Status</th><th>Broadcast engine</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="border-t border-white/5 align-top">
                <td className="p-3"><div className="font-semibold">{t.title}</div><div className="text-xs text-[var(--color-muted)]">{t.artistName}{t.genre ? ` · ${t.genre}` : ""}{t.submissionId ? " · via submission" : ""}</div></td>
                <td className="py-3 text-xs">{CATEGORY_LABEL[t.category]}</td>
                <td className="py-3"><Badge tone={t.status === "APPROVED" ? "signal" : t.status === "PENDING_REVIEW" ? "gold" : "muted"}>{t.status.replace("_", " ")}</Badge></td>
                <td className="py-3 text-xs">
                  {t.azuracastMediaId ? <span className="text-[var(--color-signal)]">Media #{t.azuracastMediaId}</span> : <span className="text-[var(--color-muted)]">Not uploaded</span>}
                  {t.playlists.length > 0 && <div className="text-[var(--color-muted)]">Playlists: {t.playlists.map((id) => playlists?.find((p) => String(p.id) === id)?.name ?? id).join(", ")}</div>}
                </td>
                <td className="space-x-1 space-y-1 p-3">
                  <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => setPreview(preview === t.id ? null : t.id)}>{preview === t.id ? "Stop" : "Preview"}</button>
                  {canApprove && t.status !== "APPROVED" && <button type="button" className="btn btn-primary px-2 py-0.5 text-xs" onClick={() => act(t.id, { action: "approve" })}>Approve</button>}
                  {canApprove && t.status === "PENDING_REVIEW" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(t.id, { action: "reject" })}>Reject</button>}
                  {canApprove && t.status === "APPROVED" && <button type="button" className="btn btn-ghost px-2 py-0.5 text-xs" onClick={() => act(t.id, { action: "archive" })}>Archive</button>}
                  {canApprove && t.status === "APPROVED" && playlists && !t.azuracastMediaId && <button type="button" className="btn btn-gold px-2 py-0.5 text-xs" onClick={() => act(t.id, { action: "push-to-azuracast" })}>Send to AzuraCast</button>}
                  {canApprove && t.status === "APPROVED" && playlists && t.azuracastMediaId && (
                    <select aria-label={`Assign ${t.title} to playlist`} className="field inline-block w-auto px-2 py-0.5 text-xs" value="" onChange={(e) => {
                      const id = Number(e.target.value); if (!id) return;
                      const current = t.playlists.map(Number);
                      act(t.id, { action: "assign-playlists", playlistIds: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] });
                    }}>
                      <option value="">Toggle playlist…</option>
                      {playlists.map((p) => <option key={p.id} value={p.id}>{t.playlists.includes(String(p.id)) ? "✓ " : ""}{p.name}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-sm text-[var(--color-muted)]">No tracks yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
