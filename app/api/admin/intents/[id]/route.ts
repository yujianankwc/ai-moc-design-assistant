import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { getIntentDetailForAdmin } from "@/services/project-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const detail = await getIntentDetailForAdmin({
      intentId: id,
      adminToken: request.headers.get("x-admin-token")
    });
    if (!detail) {
      return NextResponse.json({ error: "意向单不存在。" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端意向单详情读取失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
