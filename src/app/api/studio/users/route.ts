import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const create = z.object({ email: z.string().email(), name: z.string().trim().min(1).max(120), role: z.enum(ROLES) });

export const POST = guarded("users.manage", async (req, actor) => {
  const b = create.parse(await req.json());
  const email = b.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "A user with that email exists");
  const password = randomBytes(12).toString("base64url");
  const user = await db.user.create({ data: { email, name: b.name, role: b.role, passwordHash: await bcrypt.hash(password, 12) } });
  await audit({ userId: actor.id, action: "users.create", target: `user:${user.id}`, details: { role: b.role } });
  return { id: user.id, temporaryPassword: password };
});

const patch = z.object({ id: z.string(), role: z.enum(ROLES).optional(), active: z.boolean().optional(), resetPassword: z.boolean().optional() });

export const PATCH = guarded("users.manage", async (req, actor) => {
  const b = patch.parse(await req.json());
  if (b.id === actor.id && (b.role && b.role !== "OWNER" || b.active === false)) throw new HttpError(409, "You cannot demote or deactivate yourself");
  let temporaryPassword: string | undefined;
  const data: Record<string, unknown> = {};
  if (b.role) data.role = b.role;
  if (b.active !== undefined) data.active = b.active;
  if (b.resetPassword) { temporaryPassword = randomBytes(12).toString("base64url"); data.passwordHash = await bcrypt.hash(temporaryPassword, 12); }
  await db.user.update({ where: { id: b.id }, data });
  await audit({ userId: actor.id, action: "users.update", target: `user:${b.id}`, details: { role: b.role, active: b.active, reset: Boolean(b.resetPassword) } });
  return { ok: true, temporaryPassword };
});
