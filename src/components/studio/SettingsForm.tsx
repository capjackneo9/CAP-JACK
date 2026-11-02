"use client";
import { useState } from "react";
export function SettingsForm({ initial }: { initial: { caprio: number; independent: number; guest: number; showListenerCount: boolean } }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const sum = v.caprio + v.independent + v.guest;
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await fetch("/api/studio/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const j = await r.json(); setMsg(r.ok ? "Saved." : j.error);
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        {([["caprio", "Caprio Jackson %"], ["independent", "Independent / AI %"], ["guest", "Guest / promo / IDs %"]] as const).map(([k, l]) => (
          <label key={k} className="text-xs"><span className="label">{l}</span><input type="number" min={0} max={100} className="field" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} /></label>
        ))}
      </div>
      <p className={`text-xs ${sum === 100 ? "text-[var(--color-muted)]" : "text-red-300"}`}>Total {sum}% (must equal 100%). These are planning targets, not automated restrictions.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.showListenerCount} onChange={(e) => setV({ ...v, showListenerCount: e.target.checked })} className="accent-[var(--color-gold)]" />Show real listener counts on the public player</label>
      <button className="btn btn-primary" disabled={sum !== 100}>Save settings</button>
      {msg && <p className="text-sm text-[var(--color-gold)]">{msg}</p>}
    </form>
  );
}
