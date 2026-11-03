import { AjaxForm, Check, Field, TextArea } from "@/components/ui/AjaxForm";
import { PageHeader, Panel, Notice } from "@/components/ui/Panel";
import { TEAM_AREAS } from "@/lib/team/areas";

export const metadata = { title: "Join the team", description: "Internships and volunteer roles at Nite Cap Vibe Radio." };

export default function JoinPage() {
  return (
    <>
      <PageHeader kicker="Internships · Join the team" title="Help build NCVR"
        intro="We're looking for driven people to help grow Nite Cap Vibe Radio — from sponsorships and business development to production, marketing and tech. Help build the station's revenue and long-term stability while you build your portfolio." />
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <AjaxForm action="/api/radio/join" submitLabel="Submit application" successMessage="Thank you for applying to NCVR! We review every application and will reach out by email if there's a fit.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" required autoComplete="name" />
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Phone" name="phone" type="tel" autoComplete="tel" />
              <Field label="City / time zone" name="location" />
            </div>
            <fieldset>
              <legend className="label">Where would you like to help?<span className="text-[var(--color-live)]"> *</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEAM_AREAS.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm hover:border-[var(--color-gold)]">
                    <input type="checkbox" name="areas" value={k} className="accent-[var(--color-gold)]" />{l}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hours per week" name="hoursPerWeek" type="number" min={1} max={60} />
              <Field label="Availability *" name="availability" required hint="e.g. weekday evenings ET, weekends" />
            </div>
            <TextArea label="Relevant experience" name="experience" required rows={4} hint="Sales, marketing, finance, media, music, tech — school, jobs or personal projects all count." />
            <TextArea label="Why NCVR? What would you like to build or learn?" name="motivation" required rows={4} />
            <Field label="Portfolio / LinkedIn / social link" name="portfolioUrl" type="url" placeholder="https://" />
            <div>
              <label className="label" htmlFor="resume">Résumé (PDF, optional, max 10 MB)</label>
              <input id="resume" name="resume" type="file" accept="application/pdf,.pdf" className="field" />
            </div>
            <Check name="ageConfirm" required>I am 18 or older.</Check>
          </AjaxForm>
        </Panel>
        <div className="space-y-4">
          <Panel title="Roles we're building">
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
              <li><strong className="text-white">Revenue:</strong> sponsorship sales, advertiser relations, artist packages</li>
              <li><strong className="text-white">Stability:</strong> budgeting, grants, partnerships, operations</li>
              <li><strong className="text-white">Content:</strong> show production, DJ support, NCVR TV video</li>
              <li><strong className="text-white">Growth:</strong> social media, community, events, web</li>
            </ul>
          </Panel>
          <Notice>Applications are reviewed by station management. Your information is used only to evaluate your application.</Notice>
        </div>
      </div>
    </>
  );
}
