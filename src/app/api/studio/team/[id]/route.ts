import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { APPLICATION_STATUSES } from "@/lib/team/areas";

const body = z.object({ status: z.enum(APPLICATION_STATUSES).optional(), notes: z.string().max(5000).optional() });

export const PATCH = guarded<{ id: string }>("interns.review", async (req, actor, { id }) => {
  const b = body.parse(await req.json());
  const app = await db.internApplication.update({ where: { id }, data: b }).catch(() => null);
  if (!app) throw new HttpError(404, "Application not found");
  await audit({ userId: actor.id, action: "team.application.update", target: `application:${id}`, details: { status: b.status } });
  return { application: app };
});
