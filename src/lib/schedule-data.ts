import "server-only";
import { db, requireStation } from "./db";
import { analyzeSchedule } from "./schedule";

export async function loadSchedule() {
  const station = await requireStation();
  const [programs, overrides, hosts, sponsors] = await Promise.all([
    db.program.findMany({ where: { stationId: station.id }, include: { slots: true }, orderBy: { title: "asc" } }),
    db.scheduleOverride.findMany({ where: { stationId: station.id, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" } }),
    db.host.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.sponsor.findMany({ where: { stationId: station.id }, select: { id: true, name: true, active: true } }),
  ]);
  const slots = programs.flatMap((p) => p.slots);
  return { station, programs, overrides, hosts, sponsors, report: analyzeSchedule(programs, slots) };
}

