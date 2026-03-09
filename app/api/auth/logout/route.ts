import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, shouldUseSecureCookies } from "@/lib/session";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: shouldUseSecureCookies(request.url)
  });
  return response;
}
