import "server-only";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
if (process.env.NODE_ENV !== "production") g.prisma = db;

export const STATION_SLUG = "ncvr";

/** The primary station. Multi-station support: pass a slug. */
export async function getStation(slug = STATION_SLUG) {
  return db.station.findUnique({ where: { slug } });
}

export async function requireStation(slug = STATION_SLUG) {
  const s = await getStation(slug);
  if (!s) throw new Error(`Station "${slug}" not found — run \`npm run db:seed\``);
  return s;
}
