import { Console } from "@/components/studio/console/Console";
import { requirePagePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { config, integrations } from "@/lib/config";

export const metadata = { title: "Broadcast console" };

export default async function ConsolePage() {
  const actor = await requirePagePermission("console.broadcast");
  const { baseUrl, shortcode } = config.azuracast;
  const derivedWebcast = baseUrl && shortcode ? `${baseUrl.replace(/^http/, "ws")}/webdj/${shortcode}/` : null;
  return (
    <Console
      webcastUrl={process.env.NEXT_PUBLIC_WEBCAST_URL || derivedWebcast}
      webDjUrl={baseUrl && shortcode ? `${baseUrl}/public/${shortcode}/dj` : null}
      canReturnToAutoDJ={can(actor.role, "broadcast.returnToAutoDJ")}
      canInviteGuests={can(actor.role, "guests.invite")}
      livekitConfigured={integrations.livekit()}
    />
  );
}
