import "server-only";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { assertCan, AuthorizationError, can, type Permission, type Role } from "./rbac";

export interface Actor { id: string; role: Role; name: string; email: string }

export async function currentActor(): Promise<Actor | null> {
  const s = await auth();
  if (!s?.user?.id || !s.user.role) return null;
  return { id: s.user.id, role: s.user.role, name: s.user.name ?? "", email: s.user.email ?? "" };
}

/** For server components/pages: redirects instead of throwing. */
export async function requirePagePermission(permission: Permission): Promise<Actor> {
  const a = await currentActor();
  if (!a) redirect("/login");
  if (!can(a.role, permission)) redirect("/studio?denied=" + encodeURIComponent(permission));
  return a;
}

/** For route handlers and server actions. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const a = await currentActor();
  assertCan(a?.role, permission);
  return a!;
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error("[ncvr]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}
