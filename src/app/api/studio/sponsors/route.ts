import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { audit } from "@/lib/audit";

const create = z.object({ name: z.string().trim().min(1).max(120), website: z.string().url().optional().or(z.literal("")), disclosure: z.string().trim().min(3).max(200).default("Paid sponsorship") });

export const POST = guarded("bookings.manage", async (req, actor) => {
  const b = create.parse(await req.json());
  const station = await requireStation();
  const sponsor = await db.sponsor.create({ data: { stationId: station.id, name: b.name, website: b.website || null, disclosure: b.disclosure } });
  await audit({ userId: actor.id, action: "sponsor.create", target: `sponsor:${sponsor.id}` });
  return { sponsor };
});

export const PATCH = guarded("bookings.manage", async (req, actor) => {
  const { id, active } = z.object({ id: z.string(), active: z.boolean() }).parse(await req.json());
  const s = await db.sponsor.update({ where: { id }, data: { active } }).catch(() => null);
  if (!s) throw new HttpError(404, "Sponsor not found");
  await audit({ userId: actor.id, action: active ? "sponsor.activate" : "sponsor.deactivate", target: `sponsor:${id}` });
  return { sponsor: s };
});
