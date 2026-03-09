import { NextResponse } from "next/server";
import { createIntentForDemoUser, listIntentsForDemoUser } from "@/services/project-service";
import type { CreateIntentInput, IntentSourceType } from "@/types/intent";

function isSourceType(value: string): value is IntentSourceType {
  return value === "small_batch" || value === "crowdfunding" || value === "pro_upgrade" || value === "manual_consult";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateIntentInput;
    if (
      !body ||
      !isSourceType(String(body.sourceType || "")) ||
      !String(body.contactPhoneOrWechat || "").trim()
    ) {
      return NextResponse.json({ error: "意向单参数不完整，请检查后重试。" }, { status: 400 });
    }

    const created = await createIntentForDemoUser(body);
    return NextResponse.json({ intentId: created.id, status: created.status, createdAt: created.created_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "意向单提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    const offset = Number(url.searchParams.get("offset") || 0);
    const status = url.searchParams.get("status") || "";

    const result = await listIntentsForDemoUser({ limit, offset, status });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "意向单列表读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

