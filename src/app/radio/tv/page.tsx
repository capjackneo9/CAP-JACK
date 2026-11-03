import { existsSync } from "node:fs";
import path from "node:path";
import { TvPlayer } from "@/components/tv/TvPlayer";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "NCVR TV", description: "Music videos around the clock and live video from the NCVR studio." };

export default function TvPage() {
  const hasTvLogo = existsSync(path.join(process.cwd(), "public", BRAND.tvLogo));
  return (
    <>
      <header className="mb-8">
        {hasTvLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={BRAND.tvLogo} alt="NCVR TV" className="w-full max-w-xl drop-shadow-[0_0_24px_rgba(140,60,255,0.35)]" />
        ) : (
          <h1 className="font-[family-name:var(--font-display)] text-4xl font-black tracking-wide sm:text-5xl">NCVR <span className="text-gold-gradient">TV</span></h1>
        )}
        <p className="mt-3 max-w-3xl text-[var(--color-muted)]">
          Music videos around the clock. When a host goes live on camera, NCVR TV switches to the live feed automatically.
        </p>
      </header>
      <TvPlayer bugSrc={hasTvLogo ? BRAND.tvLogo : "/brand/ncvr-emblem.webp"} />
    </>
  );
}
