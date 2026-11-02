"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BookingControls({ id, status, priceCents, stripe }: { id: string; status: string; priceCents: number | null; stripe: boolean }) {
  const router = useRouter();
  const [price, setPrice] = useState(priceCents ? String(priceCents / 100) : "");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function patch(body: Record<string, unknown>) {
    setErr(null);
    const r = await fetch(`/api/studio/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    if (j.checkoutUrl) setLink(j.checkoutUrl);
    router.refresh();
  }
  return (
    <div className="space-y-2 text-xs">
      <select aria-label="Booking status" className="field text-xs" value={status} onChange={(e) => patch({ status: e.target.value })}>
        {["REQUESTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "SCHEDULED", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      <div className="flex gap-1">
        <input aria-label="Quoted price in USD" className="field text-xs" inputMode="decimal" placeholder="Quote $" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => patch({ priceCents: Math.round(Number(price) * 100) })} disabled={!price || Number.isNaN(Number(price))}>Save</button>
      </div>
      {stripe && <button type="button" className="btn btn-gold w-full px-2 py-1 text-xs" disabled={!["APPROVED", "SCHEDULED"].includes(status)} onClick={() => patch({ requestPayment: true, ...(price ? { priceCents: Math.round(Number(price) * 100) } : {}) })}>Create payment link</button>}
      {link && <p className="break-all">Payment link (send to client): <a className="text-[var(--color-gold)] underline" href={link} target="_blank" rel="noreferrer">{link}</a></p>}
      {err && <p className="text-red-300">{err}</p>}
    </div>
  );
}

export function SponsorForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const r = await fetch("/api/studio/sponsors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
      const j = await r.json();
      if (!r.ok) setErr(j.error); else { setErr(null); e.currentTarget.reset(); router.refresh(); }
    }}>
      <input name="name" required placeholder="Sponsor name" className="field text-xs" aria-label="Sponsor name" />
      <input name="website" type="url" placeholder="https://…" className="field text-xs" aria-label="Website" />
      <input name="disclosure" defaultValue="Paid sponsorship" className="field text-xs" aria-label="On-air disclosure" />
      <button className="btn btn-ghost text-xs">Add sponsor</button>
      {err && <p className="text-xs text-red-300 sm:col-span-4">{err}</p>}
    </form>
  );
}

export function SponsorToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return <button type="button" className="text-xs text-[var(--color-gold)] hover:underline" onClick={async () => { await fetch("/api/studio/sponsors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active: !active }) }); router.refresh(); }}>{active ? "Deactivate" : "Activate"}</button>;
}
