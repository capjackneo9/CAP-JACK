import { AjaxForm, Field, TextArea } from "@/components/ui/AjaxForm";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <PageHeader kicker="Reach the station" title="Contact" />
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <AjaxForm action="/api/radio/bookings" submitLabel="Send message" successMessage="Message received. Thank you for reaching out to NCVR.">
            <input type="hidden" name="type" value="OTHER" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="contactName" required autoComplete="name" />
              <Field label="Email" name="email" type="email" required autoComplete="email" />
            </div>
            <TextArea label="Message" name="details" required rows={6} />
          </AjaxForm>
        </Panel>
        <Panel title="Elsewhere">
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li>Main site: <a className="text-[var(--color-gold)] hover:underline" href={BRAND.mainSite}>capriojacksoncoded.si</a></li>
            {BRAND.contactEmail && <li>Email: <a className="text-[var(--color-gold)] hover:underline" href={`mailto:${BRAND.contactEmail}`}>{BRAND.contactEmail}</a></li>}
            <li>Bookings & sponsorships: use the <a className="text-[var(--color-gold)] hover:underline" href="/radio/advertise">advertise</a> page.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
