import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { appendIntentFollowupForAdmin } from "@/services/project-service";

type Body = {
  actionType?: string;
  content?: string;
  actorId?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    if (!body?.actionType?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: "actionType/content 不能为空" }, { status: 400 });
    }
    const ret = await appendIntentFollowupForAdmin({
      intentId: id,
      actionType: body.actionType,
      content: body.content,
      actorId: body.actorId,
      adminToken: request.headers.get("x-admin-token")
    });
    return NextResponse.json({ ok: true, followup: ret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端追加跟进失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
