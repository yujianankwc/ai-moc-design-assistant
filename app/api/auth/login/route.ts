import { NextResponse } from "next/server";
import { isValidInviteCode } from "@/lib/invite-auth";
import {
  createInviteSessionToken,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  shouldUseSecureCookies
} from "@/lib/session";

type LoginBody = {
  inviteCode?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

    if (!inviteCode) {
      return NextResponse.json({ error: "请输入邀请码。" }, { status: 400 });
    }

    if (!isValidInviteCode(inviteCode)) {
      return NextResponse.json({ error: "邀请码无效，请检查后重试。" }, { status: 401 });
    }

    const sessionToken = await createInviteSessionToken();
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: true,
      secure: shouldUseSecureCookies(request.url)
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登录失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
