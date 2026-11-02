import Link from "next/link";
import { PageHeader, Panel, Badge } from "@/components/ui/Panel";
import { BookingControls, SponsorForm, SponsorToggle } from "@/components/studio/BookingRow";
import { requirePagePermission } from "@/lib/session";
import { db, requireStation } from "@/lib/db";
import { integrations } from "@/lib/config";

export const metadata = { title: "Bookings & sponsors" };

export default async function BookingsPage() {
  await requirePagePermission("bookings.manage");
  const station = await requireStation();
  const [bookings, sponsors] = await Promise.all([
    db.booking.findMany({ where: { stationId: station.id }, orderBy: { createdAt: "desc" }, take: 200, include: { product: true } }),
    db.sponsor.findMany({ where: { stationId: station.id }, include: { programs: { select: { title: true } } } }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Revenue" title="Bookings & sponsors" intro="Approve requests before quoting or collecting payment. Sponsored content must be disclosed on-air and on the site." />
      <Panel title="Sponsors" kicker="Assign sponsors to programs in the scheduler">
        <ul className="mb-3 space-y-1 text-sm">
          {sponsors.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <strong>{s.name}</strong> <Badge tone={s.active ? "signal" : "muted"}>{s.active ? "active" : "inactive"}</Badge>
              <span className="text-xs text-[var(--color-muted)]">“{s.disclosure}” · {s.programs.map((p) => p.title).join(", ") || "no programs"}</span>
              <SponsorToggle id={s.id} active={s.active} />
            </li>
          ))}
        </ul>
        <SponsorForm />
      </Panel>
      <div className="space-y-3">
        {bookings.map((b) => (
          <article key={b.id} className="glass grid gap-4 p-4 lg:grid-cols-[1fr_260px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{b.type.replaceAll("_", " ")}</h2>
                <Badge tone="gold">{b.status.replace("_", " ")}</Badge>
                {b.paymentStatus !== "NONE" && <Badge tone={b.paymentStatus === "PAID" ? "signal" : "muted"}>Payment: {b.paymentStatus.toLowerCase()}</Badge>}
                {["COMMERCIAL_SPOT", "SHOW_SPONSORSHIP"].includes(b.type) && <Badge tone={b.disclosureAcknowledged ? "signal" : "danger"}>Disclosure {b.disclosureAcknowledged ? "acknowledged" : "missing"}</Badge>}
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)]">{b.contactName} · {b.email}{b.organization ? ` · ${b.organization}` : ""}{b.phone ? ` · ${b.phone}` : ""} · {b.createdAt.toLocaleString()}</p>
              {b.product && <p className="text-xs">Product: {b.product.name}</p>}
              <p className="mt-2 whitespace-pre-wrap text-sm">{b.details}</p>
              {b.preferredDates && <p className="mt-1 text-xs">Preferred: {b.preferredDates}</p>}
              {b.type === "INTERVIEW" && ["APPROVED", "SCHEDULED"].includes(b.status) && <Link href={`/studio/guests?booking=${b.id}&name=${encodeURIComponent(b.contactName)}`} className="mt-2 inline-block text-xs text-[var(--color-gold)] hover:underline">Create guest invite →</Link>}
            </div>
            <BookingControls id={b.id} status={b.status} priceCents={b.priceCents} stripe={integrations.stripe()} />
          </article>
        ))}
        {bookings.length === 0 && <p className="text-sm text-[var(--color-muted)]">No booking requests yet.</p>}
      </div>
    </div>
  );
}
