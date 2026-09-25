import { NextResponse, type NextRequest } from "next/server";
import { adminKey, SESSION_COOKIE, verifySessionToken } from "@/lib/admin/session";
import { parseCompareSlug, routes } from "@/lib/seo/routes";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Reverse-order comparisons (/compare/b-vs-a) permanently redirect to the one canonical URL
  // before rendering, so crawlers get a single clean 308.
  if (pathname.startsWith("/compare/")) {
    const parsed = parseCompareSlug(pathname.slice("/compare/".length));
    if (parsed && !parsed.isCanonical) {
      const [a, b] = parsed.canonicalSlug.split("-vs-");
      return NextResponse.redirect(new URL(routes.compare(a, b), request.url), 308);
    }
    return NextResponse.next();
  }

  // Optimistic gate for the admin UI. Every admin page and server action re-verifies the session.
  if (pathname === "/admin/login") return NextResponse.next();
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, adminKey());
  if (!ok) return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/compare/:path*"] };
