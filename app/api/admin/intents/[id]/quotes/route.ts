import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { createQuoteForIntentAdmin } from "@/services/project-service";
import type { CreateQuoteInput } from "@/types/intent";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as CreateQuoteInput;
    if (
      !body ||
      !Number.isFinite(body.quantity) ||
      !body.packageLevel?.trim() ||
      !body.designServiceLevel?.trim() ||
      !Number.isFinite(body.finalUnitPrice) ||
      !Number.isFinite(body.finalTotalPrice)
    ) {
      return NextResponse.json({ error: "报价参数不完整，请检查后重试。" }, { status: 400 });
    }

    const quote = await createQuoteForIntentAdmin({
      intentId: id,
      payload: body,
      adminToken: request.headers.get("x-admin-token")
    });
    return NextResponse.json({ quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端创建报价失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
