import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/session";
import { VISITOR_COOKIE_NAME, VISITOR_HEADER_NAME, normalizeVisitorId } from "@/lib/visitor-id";

export function proxy(request: NextRequest) {
  const existingVisitorId = normalizeVisitorId(request.cookies.get(VISITOR_COOKIE_NAME)?.value ?? "");
  const visitorId = existingVisitorId || crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(VISITOR_HEADER_NAME, visitorId);

  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = sessionCookie === SESSION_COOKIE_VALUE;
  const isProjectsRoute = pathname.startsWith("/projects");
  const isQuickRoute = pathname.startsWith("/quick");
  const isProtectedPageRoute = isProjectsRoute || isQuickRoute;
  const isProtectedApiRoute =
    pathname.startsWith("/api/projects") || pathname.startsWith("/api/quick") || pathname.startsWith("/api/service-requests");

  if (!isLoggedIn && isProtectedApiRoute) {
    return NextResponse.json({ error: "请先输入邀请码登录。" }, { status: 401 });
  }

  if (isProtectedPageRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    if (!existingVisitorId) {
      redirectResponse.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: false
      });
    }
    return redirectResponse;
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  if (!existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
