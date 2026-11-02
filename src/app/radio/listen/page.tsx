import { NowPlayingCard, RecentTracks } from "@/components/player/NowPlayingCard";
import { BrandImage } from "@/components/brand/BrandImage";
import { Panel } from "@/components/ui/Panel";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Listen live" };

export default function ListenPage() {
  return (
    <div className="grid min-h-[70vh] gap-6 lg:grid-cols-[2fr_1fr]">
      <NowPlayingCard large fallbackArt={<BrandImage src={BRAND.marblePortrait} alt="Caprio Jackson — marble portrait" width={400} height={400} glow="gold" />} />
      <Panel kicker="History" title="Recently played"><RecentTracks /></Panel>
    </div>
  );
}
