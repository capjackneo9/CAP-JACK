import { AjaxForm, Field, TextArea } from "@/components/ui/AjaxForm";
import { PageHeader, Panel } from "@/components/ui/Panel";

export const metadata = { title: "Interviews" };

export default function InterviewsPage() {
  return (
    <>
      <PageHeader kicker="On-air conversations" title="Book an interview"
        intro="Artists, authors, teachers and creators can request an on-air interview. Every request is reviewed by the host before it is scheduled." />
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <AjaxForm action="/api/radio/bookings" submitLabel="Request interview" successMessage="Your interview request was received. The station will follow up by email.">
            <input type="hidden" name="type" value="INTERVIEW" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" name="contactName" required autoComplete="name" />
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Project / organization" name="organization" />
              <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
            </div>
            <div>
              <label className="label" htmlFor="productSlug">Format</label>
              <select id="productSlug" name="productSlug" className="field" defaultValue="artist-interview-30">
                <option value="artist-interview-30">30-minute artist interview</option>
                <option value="hosted-show-60">One-hour hosted show</option>
                <option value="">Not sure — let&apos;s talk</option>
              </select>
            </div>
            <TextArea label="What would you like to talk about?" name="details" required rows={5} hint="Include your bio, links and any songs you'd like featured." />
            <Field label="Preferred dates / times (ET)" name="preferredDates" />
            <div>
              <label className="label" htmlFor="media">Press photo or audio sample (optional)</label>
              <input id="media" name="media" type="file" accept="image/*,audio/*" className="field" />
            </div>
          </AjaxForm>
        </Panel>
        <Panel title="How guest interviews work">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            <li>The host approves the request and assigns a show.</li>
            <li>You receive a private, time-limited studio link.</li>
            <li>You join a waiting room with a microphone check — you are not on air until the host brings you on.</li>
            <li>Recording happens only with your consent.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
