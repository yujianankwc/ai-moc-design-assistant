import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { updateQuoteStatusForAdmin } from "@/services/project-service";

type Body = {
  toStatus?: string;
  note?: string;
  actorId?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    if (!body?.toStatus?.trim()) {
      return NextResponse.json({ error: "toStatus 不能为空" }, { status: 400 });
    }
    const ret = await updateQuoteStatusForAdmin({
      quoteId: id,
      toStatus: body.toStatus,
      note: body.note,
      actorId: body.actorId,
      adminToken: request.headers.get("x-admin-token")
    });
    return NextResponse.json({ ok: true, ...ret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端报价状态更新失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
