import { NextResponse } from "next/server";
import { getIntentDetailForCurrentVisitor } from "@/services/project-service";

function shouldFallbackToIntentDetailUnavailable(error: unknown) {
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

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const detail = await getIntentDetailForCurrentVisitor(id);
    if (!detail) {
      return NextResponse.json({ error: "未找到该意向单。" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    if (shouldFallbackToIntentDetailUnavailable(error)) {
      return NextResponse.json({
        temporaryUnavailable: true
      });
    }
    const message = error instanceof Error ? error.message : "意向单详情读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
