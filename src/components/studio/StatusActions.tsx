"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Buttons that PATCH a resource and refresh the page with real server state. */
export function StatusActions({ url, actions, field = "to", withNotes = false }: { url: string; actions: Array<{ value: string; label: string; tone?: string }>; field?: string; withNotes?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  if (!actions.length) return null;
  return (
    <div className="space-y-2">
      {withNotes && <textarea aria-label="Review notes" className="field text-xs" rows={2} placeholder="Notes (sent with the decision)" value={notes} onChange={(e) => setNotes(e.target.value)} />}
      <div className="flex flex-wrap gap-1">
        {actions.map((a) => (
          <button key={a.value} type="button" disabled={busy} className={`btn px-3 py-1 text-xs ${a.tone ?? "btn-ghost"}`} onClick={async () => {
            setBusy(true); setErr(null);
            const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: a.value, ...(withNotes && notes ? { notes } : {}) }) });
            const j = await r.json().catch(() => ({}));
            setBusy(false);
            if (!r.ok) setErr(j.error ?? "Failed"); else router.refresh();
          }}>{a.label}</button>
        ))}
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  );
}
