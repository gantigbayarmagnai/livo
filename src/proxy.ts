import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast redirect for signed-out visitors. This only checks that a session
 * cookie exists; every page and action still verifies the session and the
 * user's permissions on the server.
 */
const PUBLIC = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (request.cookies.has("livo_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)"],
};
