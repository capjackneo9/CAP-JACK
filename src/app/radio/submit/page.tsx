import { AjaxForm, Check, Field, TextArea } from "@/components/ui/AjaxForm";
import { PageHeader, Panel, Notice } from "@/components/ui/Panel";
import { db, getStation } from "@/lib/db";
import { safe } from "@/lib/queries";
import { priceLabel } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Submit music" };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ paid?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const { data: products } = await safe(async () => {
    const s = await getStation();
    return s ? db.product.findMany({ where: { stationId: s.id, active: true, type: "ARTIST_SHOWCASE" } }) : [];
  }, []);
  return (
    <>
      <PageHeader kicker="Independent Frequency" title="Submit your music"
        intro="Independent and AI-music creators can submit tracks for editorial review. Approved tracks may be scheduled into Independent Frequency and The Independent Spotlight." />
      {sp.paid && <div className="mb-4"><Notice tone="ok">Payment received. Your submission is in the review queue — payment does not guarantee acceptance or airplay.</Notice></div>}
      {sp.cancelled && <div className="mb-4"><Notice tone="warn">Payment was cancelled. Your submission was saved; you can contact the station to complete the review fee.</Notice></div>}
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <AjaxForm action="/api/radio/submissions" submitLabel="Submit for review" successMessage="Your track is in the NCVR review queue. We'll email you when its status changes.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Artist name" name="artistName" required />
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Song title" name="songTitle" required />
              <Field label="Genre" name="genre" required />
            </div>
            <div>
              <label className="label" htmlFor="audio">Audio file<span className="text-[var(--color-live)]"> *</span></label>
              <input id="audio" name="audio" type="file" required accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*" className="field" />
              <p className="mt-1 text-xs text-[var(--color-muted)]">MP3, WAV, FLAC, OGG, M4A/AAC.</p>
            </div>
            <div>
              <label className="label" htmlFor="artwork">Artwork (optional)</label>
              <input id="artwork" name="artwork" type="file" accept=".jpg,.jpeg,.png,.webp" className="field" />
            </div>
            <TextArea label="Short biography" name="bio" required rows={4} />
            <fieldset className="space-y-2">
              <legend className="label">Was AI used to create this track?<span className="text-[var(--color-live)]"> *</span></legend>
              <label className="mr-4 text-sm"><input type="radio" name="aiGenerated" value="yes" required className="mr-2 accent-[var(--color-gold)]" />Yes</label>
              <label className="text-sm"><input type="radio" name="aiGenerated" value="no" className="mr-2 accent-[var(--color-gold)]" />No</label>
            </fieldset>
            <Field label="AI tools used (if any)" name="aiToolsUsed" hint="We review the commercial-use terms of the tools you used." />
            {products.length > 0 && (
              <div>
                <label className="label" htmlFor="promoPackage">Optional review package</label>
                <select id="promoPackage" name="promoPackage" className="field" defaultValue="">
                  <option value="">Free submission (standard queue)</option>
                  {products.map((p) => <option key={p.id} value={p.slug}>{p.name} — {priceLabel(p.priceMinCents, p.priceMaxCents)}</option>)}
                </select>
              </div>
            )}
            <Check name="commercialRights" required>I own or control all rights needed for commercial use of this recording, including any AI tool terms.</Check>
            <Check name="broadcastPermission" required>I grant NCVR permission to broadcast, stream and promote this track if it is approved.</Check>
          </AjaxForm>
        </Panel>
        <div className="space-y-4">
          <Panel title="How review works">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--color-muted)]">
              <li>Submitted → Under review → Approved or Rejected</li>
              <li>Approved tracks may be Scheduled, then marked Broadcast completed</li>
              <li>Only station managers can approve music for broadcast</li>
            </ol>
          </Panel>
          <Notice tone="warn">Paid review is optional. Payment never guarantees broadcast acceptance, audience reach or repeated airplay.</Notice>
          <Notice>Owning a song is separate from all broadcasting and royalty obligations. NCVR may ask for additional documentation before airing.</Notice>
        </div>
      </div>
    </>
  );
}
