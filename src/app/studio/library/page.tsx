import { LibraryManager } from "@/components/studio/library/LibraryManager";
import { PageHeader, Notice } from "@/components/ui/Panel";
import { requirePagePermission } from "@/lib/session";
import { can } from "@/lib/rbac";
import { db, requireStation } from "@/lib/db";
import { engine } from "@/lib/azuracast/client";
import { integrations } from "@/lib/config";

export const metadata = { title: "Music library" };

export default async function LibraryPage() {
  const actor = await requirePagePermission("library.view");
  const station = await requireStation();
  const tracks = await db.track.findMany({ where: { stationId: station.id }, orderBy: { createdAt: "desc" }, take: 500 });
  let playlists: Array<{ id: number; name: string }> | null = null;
  let err: string | null = null;
  if (integrations.azuracastAdmin()) {
    try { playlists = (await engine().playlists()).map((p) => ({ id: p.id, name: p.name })); } catch (e) { err = (e as Error).message; }
  }
  return (
    <div className="space-y-4">
      <PageHeader kicker="Caprio-first library" title="Music library" intro="Upload, preview and approve audio. Only approved tracks can be sent to AzuraCast or assigned to broadcast playlists." />
      {!integrations.azuracastAdmin() && <Notice tone="warn">AzuraCast admin API not configured — tracks can be uploaded and approved here, but not yet sent to the broadcast engine.</Notice>}
      {err && <Notice tone="error">AzuraCast: {err}</Notice>}
      <LibraryManager initial={tracks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))} canUpload={can(actor.role, "library.upload")} canApprove={can(actor.role, "library.approve")} playlists={playlists} />
    </div>
  );
}
