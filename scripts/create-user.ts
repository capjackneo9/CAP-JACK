import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { isRole } from "../src/lib/rbac";

const args = Object.fromEntries(
  process.argv.slice(2).reduce<string[][]>((acc, v, i, all) => (v.startsWith("--") ? [...acc, [v.slice(2), all[i + 1]]] : acc), []),
);

async function main() {
  const { email, name, role } = args;
  if (!email || !name || !isRole(role)) {
    console.error('Usage: npm run user:create -- --email a@b.c --name "Name" --role OWNER|STATION_MANAGER|DJ_HOST|MUSIC_REVIEWER [--password ...]');
    process.exit(1);
  }
  const password = args.password ?? randomBytes(12).toString("base64url");
  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.upsert({ where: { email: email.toLowerCase() }, update: { name, role, passwordHash, active: true }, create: { email: email.toLowerCase(), name, role, passwordHash } });
  await db.$disconnect();
  console.log(`User ${email} (${role}) ready.`);
  if (!args.password) console.log(`Temporary password (shown once): ${password}`);
}
main();
