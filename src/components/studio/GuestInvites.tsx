"use client";
import { useEffect, useState } from "react";
import { Badge } from "../ui/Panel";

interface Invite { id: string; guestName: string; guestEmail: string | null; status: string; expiresAt: string; recordingAllowed: boolean; guestConsentedAt: string | null; createdAt: string }

export function GuestInvites({ programs, preset }: { programs: Array<{ id: string; title: string }>; preset: { bookingId?: string; name?: string } }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [created, setCreated] = useState<{ link: string; expiresAt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => fetch("/api/studio/guests").then((r) => r.json()).then((j) => setInvites(j.invites ?? []));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <form className="glass grid gap-3 p-4 md:grid-cols-3" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await fetch("/api/studio/guests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          guestName: f.get("guestName"), guestEmail: f.get("guestEmail") || undefined, programId: f.get("programId") || undefined,
          bookingId: preset.bookingId, recordingAllowed: f.get("recordingAllowed") === "on", hoursValid: Number(f.get("hoursValid")),
        }) });
        const j = await r.json();
        if (!r.ok) return setErr(j.error);
        setErr(null); setCreated(j); load();
      }}>
        <div className="kicker md:col-span-3">New secure guest invitation</div>
        <label className="text-xs"><span className="label">Guest name *</span><input name="guestName" required defaultValue={preset.name} className="field" /></label>
        <label className="text-xs"><span className="label">Guest email</span><input name="guestEmail" type="email" className="field" /></label>
        <label className="text-xs"><span className="label">Show</span><select name="programId" className="field"><option value="">—</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label className="text-xs"><span className="label">Link valid for</span><select name="hoursValid" className="field" defaultValue="24">{[2, 6, 24, 48, 168].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></label>
        <label className="flex items-center gap-2 text-xs md:col-span-2"><input type="checkbox" name="recordingAllowed" className="accent-[var(--color-gold)]" />Ask guest for recording consent</label>
        <div className="md:col-span-3"><button className="btn btn-primary">Create invite</button></div>
      </form>
      {created && (
        <div role="status" className="rounded-xl border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 p-4 text-sm">
          <strong>Copy this link now — it is shown only once.</strong>
          <div className="mt-2 flex gap-2"><input readOnly className="field font-mono text-xs" value={created.link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
            <button type="button" className="btn btn-ghost text-xs" onClick={() => navigator.clipboard.writeText(created.link)}>Copy</button></div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Expires {new Date(created.expiresAt).toLocaleString()}</p>
        </div>
      )}
      {err && <p className="text-sm text-red-300">{err}</p>}
      <ul className="space-y-2">
        {invites.map((i) => (
          <li key={i.id} className="glass flex flex-wrap items-center gap-3 p-3 text-sm">
            <strong>{i.guestName}</strong>
            <Badge tone={i.status === "ON_AIR" ? "live" : i.status === "WAITING" ? "gold" : "muted"}>{i.status}</Badge>
            {i.recordingAllowed && <Badge tone={i.guestConsentedAt ? "signal" : "muted"}>{i.guestConsentedAt ? "consented to recording" : "recording consent pending"}</Badge>}
            <span className="text-xs text-[var(--color-muted)]">expires {new Date(i.expiresAt).toLocaleString()}</span>
            {["PENDING", "WAITING", "ON_AIR"].includes(i.status) && (
              <button type="button" className="ml-auto text-xs text-red-300 hover:underline" onClick={async () => { await fetch(`/api/studio/guests/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) }); load(); }}>Revoke</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
