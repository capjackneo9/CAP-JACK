"use client";
import { useState } from "react";

interface O { id: string; programId: string; startsAt: string; endsAt: string; reason: string | null }

export function OverridesPanel({ initial, programs, canEdit }: { initial: O[]; programs: Array<{ id: string; title: string }>; canEdit: boolean }) {
  const [list, setList] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const name = (id: string) => programs.find((p) => p.id === id)?.title ?? id;
  return (
    <section className="glass p-4">
      <div className="kicker">Temporary overrides</div>
      <p className="mb-3 text-xs text-[var(--color-muted)]">One-off replacements of the weekly schedule (specials, premieres). Times entered in your browser&apos;s timezone.</p>
      <ul className="mb-3 space-y-1 text-sm">
        {list.map((o) => (
          <li key={o.id} className="flex items-center justify-between rounded bg-black/30 px-2 py-1">
            <span><strong>{name(o.programId)}</strong> · {new Date(o.startsAt).toLocaleString()} → {new Date(o.endsAt).toLocaleString()} {o.reason && <em className="text-[var(--color-muted)]">({o.reason})</em>}</span>
            {canEdit && <button type="button" className="text-xs text-red-300" onClick={async () => { const r = await fetch(`/api/studio/overrides?id=${o.id}`, { method: "DELETE" }); if (r.ok) setList(list.filter((x) => x.id !== o.id)); }}>Remove</button>}
          </li>
        ))}
        {list.length === 0 && <li className="text-xs text-[var(--color-muted)]">No upcoming overrides.</li>}
      </ul>
      {canEdit && (
        <form className="grid gap-2 sm:grid-cols-5" onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body = { programId: f.get("programId"), startsAt: new Date(String(f.get("startsAt"))).toISOString(), endsAt: new Date(String(f.get("endsAt"))).toISOString(), reason: f.get("reason") || undefined };
          const r = await fetch("/api/studio/overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          const j = await r.json();
          if (!r.ok) setErr(j.error); else { setErr(null); setList([...list, j.override]); e.currentTarget.reset(); }
        }}>
          <select name="programId" className="field text-xs" required aria-label="Program">{programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <input name="startsAt" type="datetime-local" className="field text-xs" required aria-label="Starts" />
          <input name="endsAt" type="datetime-local" className="field text-xs" required aria-label="Ends" />
          <input name="reason" className="field text-xs" placeholder="Reason" aria-label="Reason" />
          <button className="btn btn-ghost text-xs">Add override</button>
        </form>
      )}
      {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
    </section>
  );
}
