import { PageHeader } from "@/components/ui/Panel";
import { VideoManager } from "@/components/studio/VideoManager";
import { requirePagePermission } from "@/lib/session";

export const metadata = { title: "NCVR TV" };

export default async function VideosPage() {
  await requirePagePermission("video.manage");
  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ncvr-tv-logo.webp" alt="NCVR TV" className="w-64" />
      <PageHeader kicker="Video channel" title="Channel manager" intro="Music-video rotation and live video feed for nitecapviberadio.tech/radio/tv." />
      <VideoManager />
    </div>
  );
}
