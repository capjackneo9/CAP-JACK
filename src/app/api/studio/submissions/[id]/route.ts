import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkTransition, SUBMISSION_STATUSES } from "@/lib/submissions/workflow";
import { permissionsFor } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const body = z.object({ to: z.enum(SUBMISSION_STATUSES), notes: z.string().trim().max(2000).optional() });

export const PATCH = guarded<{ id: string }>("submissions.review", async (req, actor, { id }) => {
  const { to, notes } = body.parse(await req.json());
  const sub = await db.submission.findUnique({ where: { id } });
  if (!sub) throw new HttpError(404, "Submission not found");
  const check = checkTransition({
    from: sub.status, to, permissions: permissionsFor(actor.role),
    rightsConfirmed: sub.commercialRightsConfirmed, broadcastPermission: sub.broadcastPermissionGranted, paid: sub.paymentStatus === "PAID",
  });
  if (!check.ok) throw new HttpError(403, check.reason);

  const history = [...((sub.history as Prisma.JsonArray) ?? []), { at: new Date().toISOString(), status: to, by: actor.email, notes: notes ?? null }] as Prisma.JsonArray;
  const updated = await db.$transaction(async (tx) => {
    const s = await tx.submission.update({ where: { id }, data: { status: to, reviewerId: actor.id, reviewNotes: notes ?? sub.reviewNotes, history } });
    if (to === "APPROVED") {
      // Approved music enters the library as an approved Independent AI-Music track (not yet in any playlist).
      await tx.track.upsert({
        where: { submissionId: id },
        update: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date() },
        create: {
          stationId: sub.stationId, title: sub.songTitle, artistName: sub.artistName, genre: sub.genre, category: "INDEPENDENT_AI",
          status: "APPROVED", rightsConfirmed: true, filePath: sub.audioPath, fileMime: sub.audioMime, fileSize: sub.audioSize,
          artworkPath: sub.artworkPath, approvedById: actor.id, approvedAt: new Date(), submissionId: id,
          credits: sub.aiGenerated ? `AI-assisted${sub.aiToolsUsed ? ` (${sub.aiToolsUsed})` : ""}` : null,
        },
      });
    }
    if (to === "REJECTED") await tx.track.updateMany({ where: { submissionId: id }, data: { status: "REJECTED", playlists: [] } });
    return s;
  });
  await audit({ userId: actor.id, action: `submission.${to.toLowerCase()}`, target: `submission:${id}` });
  return { submission: updated };
});
