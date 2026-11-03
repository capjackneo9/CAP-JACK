import { PageHeader } from "@/components/ui/Panel";
import { VideoManager } from "@/components/studio/VideoManager";
import { requirePagePermission } from "@/lib/session";

export const metadata = { title: "NCVR TV" };

export default async function VideosPage() {
  await requirePagePermission("video.manage");
  return (
    <div className="space-y-4">
      <PageHeader kicker="Video channel" title="NCVR TV" intro="Music-video rotation and live video feed for nitecapviberadio.tech/radio/tv." />
      <VideoManager />
    </div>
  );
}
