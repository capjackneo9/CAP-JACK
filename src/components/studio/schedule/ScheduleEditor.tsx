"use client";
import { useMemo, useState } from "react";
import { analyzeSchedule, DAY_SHORT, formatMinute, formatRange, describeWeekMinute, MINUTES_PER_DAY, type SlotInput } from "@/lib/schedule";
import { ConfirmAction } from "../console/parts";
import { Badge } from "../../ui/Panel";

export interface EditorProgram {
  id: string; slug: string; title: string; description: string | null; format: string; bucket: string; active: boolean; exclusive: boolean; isFallback: boolean;
  hostId: string | null; sponsorId: string | null; featuredGuest: string | null; imagePath: string | null;
  azuracastPlaylistId: number | null; syncState: string; syncedAt: string | null; syncError: string | null;
}
interface Slot extends SlotInput { key: string }

const STEP = 30; // minutes
const ROW_PX = 18; // per 30 minutes
const ROWS = MINUTES_PER_DAY / STEP;
const COLORS = ["#0A2D9E", "#6b21a8", "#0f766e", "#9d174d", "#854d0e", "#1d4ed8", "#065f46", "#7c2d12"];

let keySeq = 0;
const k = () => `s${++keySeq}`;

export function ScheduleEditor({ initialPrograms, initialSlots, canEdit, canPublish, hosts, sponsors, playlists }: {
  initialPrograms: EditorProgram[]; initialSlots: SlotInput[]; canEdit: boolean; canPublish: boolean;
  hosts: Array<{ id: string; name: string }>; sponsors: Array<{ id: string; name: string }>; playlists: Array<{ id: number; name: string }> | null;
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [slots, setSlots] = useState<Slot[]>(() => initialSlots.map((s) => ({ ...s, key: k() })));
  const [selected, setSelected] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [publishResults, setPublishResults] = useState<Array<{ program: string; state: string; message?: string }> | null>(null);
  const [saving, setSaving] = useState(false);

  const color = useMemo(() => Object.fromEntries(programs.map((p, i) => [p.id, COLORS[i % COLORS.length]])), [programs]);
  const byId = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const report = useMemo(() => analyzeSchedule(programs, slots), [programs, slots]);
  const sel = slots.find((s) => s.key === selected) ?? null;

  function update(next: Slot[]) { setSlots(next); setDirty(true); setMsg(null); }

  function onDrop(e: React.DragEvent, day: number, row: number) {
    e.preventDefault();
    if (!canEdit) return;
    const data = e.dataTransfer.getData("text/ncvr");
    const start = row * STEP;
    if (data.startsWith("program:")) {
      const programId = data.slice(8);
      const s: Slot = { key: k(), programId, dayOfWeek: day, startMinute: start, endMinute: Math.min(MINUTES_PER_DAY, start + 60) };
      update([...slots, s]);
      setSelected(s.key);
    } else if (data.startsWith("slot:")) {
      const key = data.slice(5);
      update(slots.map((s) => {
        if (s.key !== key) return s;
        const dur = s.endMinute - s.startMinute;
        const st = Math.min(start, MINUTES_PER_DAY - dur);
        return { ...s, dayOfWeek: day, startMinute: st, endMinute: st + dur };
      }));
    }
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/studio/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots: slots.map(({ key: _k, id: _i, ...s }) => s) }) });
      const j = await r.json();
      if (!r.ok) setMsg({ tone: "err", text: j.error });
      else { setDirty(false); setMsg({ tone: "ok", text: "Saved to NCVR. Not yet applied to the broadcast engine — publish to apply." }); setPrograms((ps) => ps.map((p) => (p.azuracastPlaylistId ? { ...p, syncState: "PENDING" } : p))); }
    } finally { setSaving(false); }
  }

  async function publish() {
    const r = await fetch("/api/studio/schedule/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "PUBLISH SCHEDULE" }) });
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setPublishResults(j.results);
    setPrograms((ps) => ps.map((p) => { const res = j.results.find((x: { program: string }) => x.program === p.title); return res && res.state !== "SKIPPED" ? { ...p, syncState: res.state, syncError: res.message ?? null } : p; }));
  }

  async function patchProgram(id: string, data: Partial<EditorProgram>) {
    const r = await fetch(`/api/studio/programs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setPrograms((ps) => ps.map((p) => (p.id === id ? { ...p, ...j.program } : data.isFallback ? { ...p, isFallback: false } : p)));
  }

  async function createProgram(title: string) {
    const r = await fetch("/api/studio/programs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const j = await r.json();
    if (!r.ok) return setMsg({ tone: "err", text: j.error });
    setPrograms((ps) => [...ps, { ...j.program, syncedAt: null }]);
  }

  return (
    <div className="space-y-4">
      {/* Validation summary */}
      <div className="glass flex flex-wrap items-center gap-3 p-4">
        <div className="font-mono text-sm">Coverage <strong>{(report.coveredMinutes / 60).toFixed(1)}</strong> / 168 h</div>
        {report.ok ? <Badge tone="signal">All 168 hours covered · no conflicts</Badge> : (
          <>
            {report.gaps.length > 0 && <Badge tone={report.fallbackAvailable ? "gold" : "danger"}>{report.gaps.length} gap(s){report.fallbackAvailable ? " → fallback rotation" : ""}</Badge>}
            {report.conflicts.length > 0 && <Badge tone="danger">{report.conflicts.length} conflict(s)</Badge>}
            {report.invalid.length > 0 && <Badge tone="danger">{report.invalid.length} invalid</Badge>}
          </>
        )}
        {dirty && <Badge tone="gold">Unsaved changes</Badge>}
        <div className="ml-auto flex gap-2">
          {canEdit && <button type="button" className="btn btn-primary px-4 py-1.5 text-sm" disabled={!dirty || saving || report.conflicts.length > 0 || report.invalid.length > 0} onClick={save}>{saving ? "Saving…" : "Save schedule"}</button>}
          {canPublish && (
            <ConfirmAction phrase="PUBLISH SCHEDULE" label="Publish to AzuraCast" className="btn btn-live px-4 py-1.5 text-sm" disabled={dirty || !playlists} onConfirm={publish}>
              <p className="text-sm text-[var(--color-muted)]">Updates playlist schedules on the live broadcast engine. Programs without a linked playlist are skipped.</p>
            </ConfirmAction>
          )}
        </div>
      </div>
      {!playlists && <p className="text-xs text-[var(--color-gold)]">AzuraCast admin API not connected — schedule changes are saved in NCVR only and cannot be published yet.</p>}
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`text-sm ${msg.tone === "err" ? "text-red-300" : "text-[var(--color-signal)]"}`}>{msg.text}</p>}
      {(report.gaps.length > 0 || report.conflicts.length > 0) && (
        <ul className="glass max-h-40 overflow-auto p-3 text-xs">
          {[...report.conflicts, ...report.gaps, ...report.invalid].map((i, n) => <li key={n} className={i.kind === "gap" ? "text-[var(--color-gold)]" : "text-red-300"}>{i.message}</li>)}
        </ul>
      )}
      {publishResults && (
        <div className="glass p-3 text-xs">
          <div className="kicker mb-1">Broadcast engine results</div>
          <ul className="grid gap-1 sm:grid-cols-2">{publishResults.map((r) => <li key={r.program}><Badge tone={r.state === "SYNCED" ? "signal" : r.state === "FAILED" ? "danger" : "muted"}>{r.state}</Badge> {r.program}{r.message ? ` — ${r.message}` : ""}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-[260px_1fr_300px]">
        {/* Palette */}
        <aside className="glass p-3" aria-label="Programs">
          <div className="kicker mb-2">Programs · drag onto the grid</div>
          <ul className="max-h-[70vh] space-y-1 overflow-auto">
            {programs.map((p) => (
              <li key={p.id} draggable={canEdit && p.active} onDragStart={(e) => e.dataTransfer.setData("text/ncvr", `program:${p.id}`)}
                className={`flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5 text-xs ${p.active ? "cursor-grab" : "opacity-40"}`}>
                <span className="h-3 w-3 shrink-0 rounded" style={{ background: color[p.id] }} />
                <span className="flex-1 truncate">{p.title}</span>
                {p.isFallback && <span title="Fallback rotation" className="text-[var(--color-gold)]">★</span>}
                <SyncDot state={p.syncState} />
                <button type="button" className="text-[var(--color-muted)] hover:text-white" onClick={() => setEditingProgram(p.id)} aria-label={`Edit ${p.title}`}>Edit</button>
              </li>
            ))}
          </ul>
          {canEdit && <NewProgram onCreate={createProgram} />}
        </aside>

        {/* Week grid */}
        <div className="glass overflow-x-auto p-3">
          <div className="grid min-w-[760px] grid-cols-[48px_repeat(7,1fr)] gap-1">
            <div />
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <div key={d} className="text-center font-[family-name:var(--font-display)] text-xs font-bold tracking-widest">{DAY_SHORT[d]}</div>)}
            <div className="relative" style={{ height: ROWS * ROW_PX }}>
              {Array.from({ length: 24 }).map((_, h) => <div key={h} className="absolute right-1 font-mono text-[9px] text-[var(--color-muted)]" style={{ top: h * 2 * ROW_PX - 4 }}>{formatMinute(h * 60)}</div>)}
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="relative rounded bg-black/30" style={{ height: ROWS * ROW_PX }}>
                {Array.from({ length: ROWS }).map((_, r) => (
                  <div key={r} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, d, r)}
                    className={`absolute inset-x-0 ${r % 2 === 0 ? "border-t border-white/10" : "border-t border-white/[0.03]"}`} style={{ top: r * ROW_PX, height: ROW_PX }} />
                ))}
                {slots.filter((s) => s.dayOfWeek === d).map((s) => {
                  const p = byId.get(s.programId);
                  const conflict = report.conflicts.some((c) => c.a === s || c.b === s);
                  return (
                    <button type="button" key={s.key} draggable={canEdit} onDragStart={(e) => e.dataTransfer.setData("text/ncvr", `slot:${s.key}`)}
                      onClick={() => setSelected(s.key)}
                      className={`absolute inset-x-0.5 overflow-hidden rounded-md border px-1 text-left text-[10px] leading-tight ${selected === s.key ? "border-[var(--color-gold)] ring-1 ring-[var(--color-gold)]" : conflict ? "border-red-500" : "border-white/20"} ${p?.active === false ? "opacity-40" : ""}`}
                      style={{ top: (s.startMinute / STEP) * ROW_PX, height: ((s.endMinute - s.startMinute) / STEP) * ROW_PX - 1, background: color[s.programId] }}
                      aria-label={`${p?.title ?? "Unknown"} ${DAY_SHORT[d]} ${formatRange(s.startMinute, s.endMinute)}`}>
                      <div className="font-semibold">{p?.title}</div>
                      <div className="opacity-70">{formatRange(s.startMinute, s.endMinute)}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Slot inspector (keyboard-accessible editing) */}
        <aside className="glass space-y-3 p-3" aria-label="Slot editor">
          <div className="kicker">Selected slot</div>
          {!sel ? <p className="text-xs text-[var(--color-muted)]">Select a block on the grid, or add one below.</p> : (
            <SlotForm slot={sel} programs={programs} disabled={!canEdit}
              onChange={(n) => update(slots.map((s) => (s.key === sel.key ? { ...s, ...n } : s)))}
              onDelete={() => { update(slots.filter((s) => s.key !== sel.key)); setSelected(null); }}
              onDuplicateWeekdays={() => update([...slots, ...[1, 2, 3, 4, 5].filter((d) => d !== sel.dayOfWeek).map((d) => ({ ...sel, key: k(), id: undefined, dayOfWeek: d }))])} />
          )}
          {canEdit && (
            <button type="button" className="btn btn-ghost w-full text-xs" onClick={() => {
              const s: Slot = { key: k(), programId: programs.find((p) => p.isFallback)?.id ?? programs[0].id, dayOfWeek: 1, startMinute: 0, endMinute: 60 };
              update([...slots, s]); setSelected(s.key);
            }}>+ Add slot</button>
          )}
          <p className="text-[10px] text-[var(--color-muted)]">All times Eastern (America/New_York, DST observed). Slots end at or before midnight — split overnight shows. Uncovered time falls back to the ★ program.</p>
        </aside>
      </div>

      {editingProgram && byId.get(editingProgram) && (
        <ProgramDialog program={byId.get(editingProgram)!} hosts={hosts} sponsors={sponsors} playlists={playlists} canEdit={canEdit}
          onClose={() => setEditingProgram(null)} onSave={async (d) => { await patchProgram(editingProgram, d); setEditingProgram(null); }} />
      )}
      {report.gaps[0] && <span className="sr-only">First gap at {describeWeekMinute(report.gaps[0].start)}</span>}
    </div>
  );
}

function SyncDot({ state }: { state: string }) {
  const map: Record<string, [string, string]> = { SYNCED: ["bg-[var(--color-signal)]", "Applied to AzuraCast"], PENDING: ["bg-[var(--color-gold)]", "Changes not yet published"], FAILED: ["bg-red-500", "Publish failed"], NOT_LINKED: ["bg-white/20", "No AzuraCast playlist linked"] };
  const [c, t] = map[state] ?? map.NOT_LINKED;
  return <span className={`h-2 w-2 rounded-full ${c}`} title={t} aria-label={t} />;
}

const TIMES = Array.from({ length: ROWS + 1 }, (_, i) => i * STEP);

function SlotForm({ slot, programs, onChange, onDelete, onDuplicateWeekdays, disabled }: { slot: Slot; programs: EditorProgram[]; onChange: (s: Partial<Slot>) => void; onDelete: () => void; onDuplicateWeekdays: () => void; disabled: boolean }) {
  return (
    <div className="space-y-2 text-xs">
      <label className="block"><span className="label">Program</span>
        <select className="field" disabled={disabled} value={slot.programId} onChange={(e) => onChange({ programId: e.target.value })}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select></label>
      <label className="block"><span className="label">Day</span>
        <select className="field" disabled={disabled} value={slot.dayOfWeek} onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Start</span>
          <select className="field" disabled={disabled} value={slot.startMinute} onChange={(e) => onChange({ startMinute: Number(e.target.value) })}>
            {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{formatMinute(t)}</option>)}
          </select></label>
        <label><span className="label">End</span>
          <select className="field" disabled={disabled} value={slot.endMinute} onChange={(e) => onChange({ endMinute: Number(e.target.value) })}>
            {TIMES.slice(1).map((t) => <option key={t} value={t}>{t === MINUTES_PER_DAY ? "Midnight" : formatMinute(t)}</option>)}
          </select></label>
      </div>
      {!disabled && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className="btn btn-ghost px-3 py-1 text-xs" onClick={onDuplicateWeekdays}>Copy to Mon–Fri</button>
          <button type="button" className="btn btn-danger px-3 py-1 text-xs" onClick={onDelete}>Delete slot</button>
        </div>
      )}
    </div>
  );
}

function NewProgram({ onCreate }: { onCreate: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onCreate(t.trim()); setT(""); } }}>
      <input className="field py-1 text-xs" placeholder="New program title" value={t} onChange={(e) => setT(e.target.value)} aria-label="New program title" />
      <button className="btn btn-ghost px-2 py-1 text-xs">Add</button>
    </form>
  );
}

function ProgramDialog({ program, hosts, sponsors, playlists, canEdit, onClose, onSave }: {
  program: EditorProgram; hosts: Array<{ id: string; name: string }>; sponsors: Array<{ id: string; name: string }>; playlists: Array<{ id: number; name: string }> | null;
  canEdit: boolean; onClose: () => void; onSave: (d: Partial<EditorProgram>) => Promise<void>;
}) {
  const [d, setD] = useState({ ...program });
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Edit ${program.title}`} className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/70 p-4">
      <form className="glass-strong w-full max-w-xl space-y-3 p-5" onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ title: d.title, description: d.description, format: d.format, bucket: d.bucket, hostId: d.hostId, sponsorId: d.sponsorId, featuredGuest: d.featuredGuest, active: d.active, exclusive: d.exclusive, ...(d.isFallback && !program.isFallback ? { isFallback: true } : {}), azuracastPlaylistId: d.azuracastPlaylistId });
      }}>
        <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">Program settings</h3>
        <fieldset disabled={!canEdit} className="space-y-3">
          <label className="block"><span className="label">Title</span><input className="field" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>
          <label className="block"><span className="label">Description</span><textarea className="field" rows={3} value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label><span className="label">Format</span><select className="field" value={d.format} onChange={(e) => setD({ ...d, format: e.target.value })}><option value="AUTOMATED">Automated rotation</option><option value="LIVE">Live</option><option value="PRERECORDED">Prerecorded</option></select></label>
            <label><span className="label">Rotation bucket</span><select className="field" value={d.bucket} onChange={(e) => setD({ ...d, bucket: e.target.value })}><option value="CAPRIO">Caprio</option><option value="INDEPENDENT">Independent</option><option value="GUEST">Guest / promo</option></select></label>
            <label><span className="label">Host</span><select className="field" value={d.hostId ?? ""} onChange={(e) => setD({ ...d, hostId: e.target.value || null })}><option value="">—</option>{hosts.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
            <label><span className="label">Sponsor</span><select className="field" value={d.sponsorId ?? ""} onChange={(e) => setD({ ...d, sponsorId: e.target.value || null })}><option value="">None</option>{sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          </div>
          <label className="block"><span className="label">Featured guest</span><input className="field" value={d.featuredGuest ?? ""} onChange={(e) => setD({ ...d, featuredGuest: e.target.value || null })} /></label>
          <label className="block"><span className="label">AzuraCast playlist</span>
            {playlists ? (
              <select className="field" value={d.azuracastPlaylistId ?? ""} onChange={(e) => setD({ ...d, azuracastPlaylistId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Not linked</option>{playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : <p className="text-xs text-[var(--color-muted)]">Connect the AzuraCast admin API to link playlists.</p>}
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.active} disabled={program.isFallback} onChange={(e) => setD({ ...d, active: e.target.checked })} className="accent-[var(--color-gold)]" />Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.exclusive} onChange={(e) => setD({ ...d, exclusive: e.target.checked })} className="accent-[var(--color-gold)]" />Exclusive (no overlaps)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.isFallback} disabled={program.isFallback} onChange={(e) => setD({ ...d, isFallback: e.target.checked })} className="accent-[var(--color-gold)]" />Station fallback ★</label>
          </div>
          <label className="block"><span className="label">Promotional show image</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="field text-xs" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              const fd = new FormData(); fd.append("image", f);
              const r = await fetch(`/api/studio/programs/${program.id}`, { method: "PATCH", body: fd });
              const j = await r.json(); setImgMsg(r.ok ? "Image uploaded." : j.error);
            }} />
          </label>
          {imgMsg && <p className="text-xs text-[var(--color-gold)]">{imgMsg}</p>}
          {program.syncError && <p className="text-xs text-red-300">Last publish error: {program.syncError}</p>}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          {canEdit && <button className="btn btn-primary">Save program</button>}
        </div>
      </form>
    </div>
  );
}
