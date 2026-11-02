import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { audit } from "@/lib/audit";

const body = z.object({ programId: z.string(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), reason: z.string().trim().max(300).optional() });

export const POST = guarded("schedule.edit", async (req, actor) => {
  const b = body.parse(await req.json());
  if (b.endsAt <= b.startsAt) throw new HttpError(400, "Override must end after it starts");
  if (b.endsAt.getTime() - b.startsAt.getTime() > 7 * 86400_000) throw new HttpError(400, "Overrides are limited to 7 days");
  const station = await requireStation();
  const clash = await db.scheduleOverride.findFirst({ where: { stationId: station.id, startsAt: { lt: b.endsAt }, endsAt: { gt: b.startsAt } } });
  if (clash) throw new HttpError(409, "Another override already covers part of that time");
  const o = await db.scheduleOverride.create({ data: { stationId: station.id, ...b } });
  await audit({ userId: actor.id, action: "schedule.override.create", target: `override:${o.id}` });
  return { override: o };
});

export const DELETE = guarded("schedule.edit", async (req, actor) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing id");
  await db.scheduleOverride.delete({ where: { id } });
  await audit({ userId: actor.id, action: "schedule.override.delete", target: `override:${id}` });
  return { ok: true };
});
