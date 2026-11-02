import { PageHeader, Panel } from "@/components/ui/Panel";
import { BrandImage } from "@/components/brand/BrandImage";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHeader kicker="Mission & ownership" title="About NCVR" />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <BrandImage src={BRAND.marblePortrait} alt="Caprio Jackson — marble portrait" width={600} height={700} glow="gold" />
        <div className="space-y-5">
          <Panel title="Our mission">
            <p className="text-[var(--color-muted)]">
              Nite Cap Vibe Radio is a 24/7 Afro-futuristic digital broadcast network. Music, metaphysics, culture and
              conversation — broadcasting beyond the ordinary. {BRAND.tagline}
            </p>
          </Panel>
          <Panel title="Ownership">
            <p className="text-[var(--color-muted)]">
              NCVR is owned and operated under the {BRAND.owner} brand. Caprio Jackson&apos;s original music is the
              foundation of the station, with space for approved independent artists, AI-music creators, live DJs,
              interviews and weekend metaphysical programming.
            </p>
          </Panel>
          <Panel title="Editorial standards">
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
              <li>Every track is reviewed before it can enter broadcast rotation.</li>
              <li>Paid submission review never guarantees acceptance, audience reach or repeated airplay.</li>
              <li>Sponsored content is identified on-air and on this website.</li>
              <li>Creators confirm commercial-use and broadcast rights for everything they submit.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
