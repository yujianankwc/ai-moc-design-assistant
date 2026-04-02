import { NextResponse } from "next/server";
import { createIntentForCurrentVisitor, listIntentsForCurrentVisitor } from "@/services/project-service";
import type { CreateIntentInput, IntentSourceType } from "@/types/intent";

function shouldFallbackToEmptyIntentList(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    message.includes("演示用户初始化失败") ||
    message.includes("缺少 Supabase 环境变量") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout")
  );
}

function isSourceType(value: string): value is IntentSourceType {
  return value === "small_batch" || value === "crowdfunding" || value === "pro_upgrade" || value === "manual_consult";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateIntentInput;
    if (!body || !isSourceType(String(body.sourceType || ""))) {
      return NextResponse.json({ error: "意向单参数不完整，请检查后重试。" }, { status: 400 });
    }

    const created = await createIntentForCurrentVisitor(body);
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

    const result = await listIntentsForCurrentVisitor({ limit, offset, status });
    return NextResponse.json(result);
  } catch (error) {
    if (shouldFallbackToEmptyIntentList(error)) {
      const url = new URL(request.url);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 20), 100));
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
      return NextResponse.json({
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
        fallback: true
      });
    }
    const message = error instanceof Error ? error.message : "意向单列表读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
