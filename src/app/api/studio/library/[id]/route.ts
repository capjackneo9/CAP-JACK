import { z } from "zod";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { engine } from "@/lib/azuracast/client";
import { integrations } from "@/lib/config";
import { resolveKey } from "@/lib/storage";

export const runtime = "nodejs";

const body = z.object({
  action: z.enum(["approve", "reject", "archive", "update", "assign-playlists", "push-to-azuracast"]),
  title: z.string().trim().min(1).max(200).optional(),
  artistName: z.string().trim().min(1).max(200).optional(),
  genre: z.string().trim().max(80).optional(),
  playlistIds: z.array(z.number().int().positive()).optional(),
});

export const PATCH = guarded<{ id: string }>("library.view", async (req, actor, { id }) => {
  const b = body.parse(await req.json());
  const track = await db.track.findUnique({ where: { id } });
  if (!track) throw new HttpError(404, "Track not found");

  if (b.action === "update") {
    if (!can(actor.role, "library.upload")) throw new HttpError(403, "Missing permission: library.upload");
    return { track: await db.track.update({ where: { id }, data: { title: b.title, artistName: b.artistName, genre: b.genre } }) };
  }

  if (!can(actor.role, "library.approve")) throw new HttpError(403, "Only station managers can approve or schedule music");

  if (b.action === "approve") {
    if (!track.rightsConfirmed) throw new HttpError(400, "Rights must be confirmed before approval");
    const t = await db.track.update({ where: { id }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() } });
    await audit({ userId: actor.id, action: "library.approve", target: `track:${id}`, details: { title: t.title } });
    return { track: t };
  }
  if (b.action === "reject" || b.action === "archive") {
    const t = await db.track.update({ where: { id }, data: { status: b.action === "reject" ? "REJECTED" : "ARCHIVED", playlists: [] } });
    // Remove from broadcast playlists on the engine too.
    if (t.azuracastMediaId && integrations.azuracastAdmin()) await engine().assignMediaPlaylists(t.azuracastMediaId, []).catch(() => null);
    await audit({ userId: actor.id, action: `library.${b.action}`, target: `track:${id}`, liveImpact: Boolean(t.azuracastMediaId) });
    return { track: t };
  }

  // Everything below touches the live broadcast library.
  if (track.status !== "APPROVED") throw new HttpError(409, "Unapproved tracks cannot enter broadcast playlists");
  if (!integrations.azuracastAdmin()) throw new HttpError(503, "AzuraCast admin API is not configured");

  if (b.action === "push-to-azuracast") {
    const data = await readFile(resolveKey(track.filePath));
    const ext = path.extname(track.filePath);
    const remotePath = `ncvr/${track.category.toLowerCase()}/${track.artistName} - ${track.title}${ext}`.replace(/[\\:*?"<>|]/g, "");
    const media = await engine().uploadMedia(remotePath, data);
    const t = await db.track.update({ where: { id }, data: { azuracastMediaId: media.id, azuracastPath: media.path } });
    await audit({ userId: actor.id, action: "library.pushToEngine", target: `track:${id}`, details: { mediaId: media.id }, liveImpact: true });
    return { track: t };
  }

  // assign-playlists
  if (!track.azuracastMediaId) throw new HttpError(409, "Upload the track to AzuraCast first");
  const ids = b.playlistIds ?? [];
  await engine().assignMediaPlaylists(track.azuracastMediaId, ids);
  const t = await db.track.update({ where: { id }, data: { playlists: ids.map(String) } });
  await audit({ userId: actor.id, action: "library.assignPlaylists", target: `track:${id}`, details: { playlists: ids }, liveImpact: true });
  return { track: t };
});
