import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

/**
 * - studio.<domain> → serves /studio (host-based rewrite)
 * - /studio and /api/studio require studio.access (checked again server-side in every handler)
 */
export default auth((req) => {
  const host = req.headers.get("host") ?? "";
  const url = req.nextUrl;
  if (host.startsWith("studio.") && !url.pathname.startsWith("/studio") && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/_next")) {
    const to = url.clone();
    to.pathname = `/studio${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(to);
  }
  if (url.pathname.startsWith("/api/studio") && !req.auth) {
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  }
  return undefined;
});

export const config = {
  matcher: ["/studio/:path*", "/api/studio/:path*", "/((?!_next/static|_next/image|favicon|brand).*)"],
};
