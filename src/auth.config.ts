import type { NextAuthConfig } from "next-auth";
import { can, isRole } from "@/lib/rbac";

/** Edge-safe Auth.js config (used by middleware). No DB / bcrypt here. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.uid = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = isRole(token.role) ? token.role : undefined;
      }
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/studio")) {
        return can(auth?.user?.role, "studio.access");
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
