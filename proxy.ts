import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, shouldUseSecureCookies, verifyInviteSessionToken } from "@/lib/session";
import {
  createVisitorToken,
  resolveVisitorIdFromToken,
  VISITOR_COOKIE_NAME,
  VISITOR_HEADER_NAME
} from "@/lib/visitor-id";

export async function proxy(request: NextRequest) {
  const visitorToken = request.cookies.get(VISITOR_COOKIE_NAME)?.value ?? "";
  const existingVisitorId = await resolveVisitorIdFromToken(visitorToken);
  const visitorId = existingVisitorId || crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const nextVisitorToken = existingVisitorId ? visitorToken : await createVisitorToken(visitorId);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(VISITOR_HEADER_NAME, visitorId);

  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isLoggedIn = await verifyInviteSessionToken(sessionCookie);
  const isProjectsRoute = pathname.startsWith("/projects");
  const isQuickRoute = pathname.startsWith("/quick");
  const isIntentsRoute = pathname.startsWith("/intents");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedPageRoute = isProjectsRoute || isQuickRoute || isIntentsRoute || isAdminRoute;
  const isProtectedApiRoute =
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/quick") ||
    pathname.startsWith("/api/service-requests") ||
    pathname.startsWith("/api/intents") ||
    pathname.startsWith("/api/quotes") ||
    pathname.startsWith("/api/admin");

  if (!isLoggedIn && isProtectedApiRoute) {
    return NextResponse.json({ error: "请先输入邀请码登录。" }, { status: 401 });
  }

  if (isProtectedPageRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextPath);
    const redirectResponse = NextResponse.redirect(loginUrl);
    if (!existingVisitorId) {
      redirectResponse.cookies.set(VISITOR_COOKIE_NAME, nextVisitorToken, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: true,
        secure: shouldUseSecureCookies(request.url)
      });
    }
    return redirectResponse;
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  if (!existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE_NAME, nextVisitorToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: shouldUseSecureCookies(request.url)
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
