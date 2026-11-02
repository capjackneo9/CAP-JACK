import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { validateGoals } from "@/lib/rotation";
import { audit } from "@/lib/audit";

const body = z.object({ caprio: z.number().int(), independent: z.number().int(), guest: z.number().int(), showListenerCount: z.boolean() });

export const PUT = guarded("settings.rotation", async (req, actor) => {
  const b = body.parse(await req.json());
  const err = validateGoals(b);
  if (err) throw new HttpError(400, err);
  const station = await requireStation();
  await db.station.update({ where: { id: station.id }, data: { rotationCaprioPct: b.caprio, rotationIndiePct: b.independent, rotationGuestPct: b.guest, showListenerCount: b.showListenerCount } });
  await audit({ userId: actor.id, action: "settings.update", details: b });
  return { ok: true };
});
