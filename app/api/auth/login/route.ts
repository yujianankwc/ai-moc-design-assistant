import { NextResponse } from "next/server";
import { isValidInviteCode } from "@/lib/invite-auth";
import { SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/session";

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

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE, {
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
      httpOnly: false
    });
    return response;
  } catch {
    return NextResponse.json({ error: "登录失败，请稍后重试。" }, { status: 500 });
  }
}

