import "server-only";
import { db } from "./db";
import type { Prisma } from "@prisma/client";

export async function audit(entry: {
  userId?: string | null; action: string; target?: string; details?: Prisma.InputJsonValue; liveImpact?: boolean;
}) {
  try {
    await db.auditLog.create({
      data: { userId: entry.userId ?? null, action: entry.action, target: entry.target, details: entry.details, liveImpact: entry.liveImpact ?? false },
    });
  } catch (e) {
    console.error("[audit] failed to write", entry.action, e);
  }
}
