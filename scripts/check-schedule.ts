import { PrismaClient } from "@prisma/client";
import { analyzeSchedule } from "../src/lib/schedule/coverage";

async function main() {
  const db = new PrismaClient();
  const programs = await db.program.findMany({ include: { slots: true } });
  const r = analyzeSchedule(programs, programs.flatMap((p) => p.slots));
  await db.$disconnect();
  console.log(`Covered ${r.coveredMinutes / 60}/${r.totalMinutes / 60} hours. Gaps: ${r.gaps.length}. Conflicts: ${r.conflicts.length}. Invalid: ${r.invalid.length}.`);
  [...r.gaps, ...r.conflicts, ...r.invalid].forEach((i) => console.log(" -", i.message));
  process.exit(r.ok ? 0 : 1);
}
main();
