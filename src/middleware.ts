import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * - studio.<domain> → serves /studio (host-based rewrite)
 * - /studio pages require studio.access (and every API handler checks its own permission)
 */
export default auth((req) => {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl;
  if (host.startsWith("studio.") && !url.pathname.startsWith("/studio") && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/_next")) {
    const to = url.clone();
    to.pathname = `/studio${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(to);
  }
  return undefined;
});

export const config = {
  // API routes are excluded on purpose: every route checks permissions itself, and keeping
  // large uploads (videos, audio) out of middleware avoids request-body size limits.
  matcher: ["/studio/:path*", "/((?!api|_next/static|_next/image|favicon|brand).*)"],
};
