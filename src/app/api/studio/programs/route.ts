import { z } from "zod";
import { guarded } from "@/lib/api";
import { db, requireStation } from "@/lib/db";
import { audit } from "@/lib/audit";

const body = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).optional(), format: z.enum(["LIVE", "PRERECORDED", "AUTOMATED"]).default("AUTOMATED") });

export const POST = guarded("schedule.edit", async (req, actor) => {
  const b = body.parse(await req.json());
  const station = await requireStation();
  const base = b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "show";
  let slug = base;
  for (let i = 2; await db.program.findUnique({ where: { stationId_slug: { stationId: station.id, slug } } }); i++) slug = `${base}-${i}`;
  const program = await db.program.create({ data: { stationId: station.id, slug, title: b.title, description: b.description, format: b.format } });
  await audit({ userId: actor.id, action: "program.create", target: `program:${program.id}` });
  return { program };
});
