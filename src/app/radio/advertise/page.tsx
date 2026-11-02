import { AjaxForm, Check, Field, TextArea } from "@/components/ui/AjaxForm";
import { PageHeader, Panel, Notice } from "@/components/ui/Panel";
import { db, getStation } from "@/lib/db";
import { safe } from "@/lib/queries";
import { priceLabel } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Advertise" };

export default async function AdvertisePage() {
  const { data: products } = await safe(async () => {
    const s = await getStation();
    return s ? db.product.findMany({ where: { stationId: s.id, active: true }, orderBy: { priceMinCents: "asc" } }) : [];
  }, []);
  return (
    <>
      <PageHeader kicker="Partner with NCVR" title="Advertise with us"
        intro="Reach the NCVR audience with commercial spots, show sponsorships, artist showcases and hosted programming." />
      {products.length > 0 && (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="glass p-5">
              <div className="kicker">{p.type.replaceAll("_", " ").toLowerCase()}</div>
              <h2 className="mt-1 font-bold">{p.name}</h2>
              <div className="mt-2 font-[family-name:var(--font-display)] text-2xl text-gold-gradient">{priceLabel(p.priceMinCents, p.priceMaxCents)}</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{p.description}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mb-8 text-xs text-[var(--color-muted)]">Introductory pricing. Final quotes are confirmed by the station after review.</p>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Booking request">
          <AjaxForm action="/api/radio/bookings" submitLabel="Send request" successMessage="Thanks — your request is with the NCVR team. We'll reply with availability and a quote.">
            <div>
              <label className="label" htmlFor="type">What are you booking?<span className="text-[var(--color-live)]"> *</span></label>
              <select id="type" name="type" className="field" required defaultValue="COMMERCIAL_SPOT">
                <option value="COMMERCIAL_SPOT">Commercial airtime</option>
                <option value="COMMERCIAL_PRODUCTION">Commercial production</option>
                <option value="SHOW_SPONSORSHIP">Show sponsorship</option>
                <option value="ARTIST_SHOWCASE">Independent artist showcase</option>
                <option value="HOSTED_SHOW">Hosted radio show</option>
                <option value="OTHER">Something else</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" name="contactName" required autoComplete="name" />
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Business / brand" name="organization" />
              <Field label="Phone" name="phone" type="tel" />
            </div>
            <TextArea label="Campaign details" name="details" required rows={5} hint="Goals, target shows or time slots, budget, and flight dates." />
            <Field label="Preferred dates" name="preferredDates" />
            <div>
              <label className="label" htmlFor="media">Existing spot / creative (optional)</label>
              <input id="media" name="media" type="file" accept="audio/*,image/*" className="field" />
            </div>
            <Check name="disclosure">I understand sponsored content is clearly identified on-air and on the NCVR website (required for airtime and sponsorships).</Check>
          </AjaxForm>
        </Panel>
        <div className="space-y-4">
          <Notice tone="warn">All advertising is subject to NCVR content approval. Sponsored segments are disclosed to listeners.</Notice>
          <Notice>Payment is requested only after the station approves your booking and confirms a quote.</Notice>
        </div>
      </div>
    </>
  );
}
