import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorResponse, requirePermission, type Actor } from "./session";
import type { Permission } from "./rbac";
import { BroadcastEngineError } from "./azuracast/client";

type Ctx<P> = { params: Promise<P> };

/** Wrap a studio route handler with an explicit permission check + uniform errors. */
export function guarded<P = Record<string, string>>(permission: Permission, fn: (req: Request, actor: Actor, params: P) => Promise<Response | unknown>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const actor = await requirePermission(permission);
      const out = await fn(req, actor, ctx?.params ? await ctx.params : ({} as P));
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      if (e instanceof BroadcastEngineError) return NextResponse.json({ error: e.message, engine: true }, { status: 502 });
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      return errorResponse(e);
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Live-impacting operations must send the exact confirmation phrase. */
export function requireConfirmation(body: { confirm?: string } | null, phrase: string) {
  if (body?.confirm !== phrase) throw new HttpError(428, `Confirmation required: type "${phrase}"`);
}
