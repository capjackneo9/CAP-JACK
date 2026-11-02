import type { Role } from "@/lib/rbac";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role?: Role; name?: string | null; email?: string | null };
  }
}
