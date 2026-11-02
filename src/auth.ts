import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Simple in-memory brute-force throttle (per process). Put a WAF/rate limiter in front in production.
const attempts = new Map<string, { n: number; until: number }>();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const a = attempts.get(email);
        if (a && a.until > Date.now()) return null;
        const user = await db.user.findUnique({ where: { email } });
        const ok = user?.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
        if (!ok || !user) {
          const n = (a?.n ?? 0) + 1;
          attempts.set(email, { n, until: n >= 5 ? Date.now() + 15 * 60_000 : 0 });
          return null;
        }
        attempts.delete(email);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
