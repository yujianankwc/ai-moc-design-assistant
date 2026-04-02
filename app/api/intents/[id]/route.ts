import { NextResponse } from "next/server";
import {
  getIntentDetailForCurrentVisitor,
  updateIntentForCurrentVisitor
} from "@/services/project-service";

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {
          contactPhoneOrWechat?: string;
          contactPreference?: string;
          preferPriorityContact?: boolean;
          snapshot?: {
            intentKind?: "quick_publish" | "purchase_interest";
            saleMode?: string;
            crowdfundingTargetPeople?: number;
            uiContext?: Record<string, unknown>;
          };
        }
      | null;

    if (!body) {
      return NextResponse.json({ error: "更新参数不完整。" }, { status: 400 });
    }

    await updateIntentForCurrentVisitor({
      intentId: id,
      contactPhoneOrWechat:
        typeof body.contactPhoneOrWechat === "string" ? body.contactPhoneOrWechat : undefined,
      contactPreference:
        typeof body.contactPreference === "string" ? body.contactPreference : undefined,
      preferPriorityContact:
        typeof body.preferPriorityContact === "boolean" ? body.preferPriorityContact : undefined,
      snapshot: body.snapshot
        ? {
            intentKind:
              body.snapshot.intentKind === "quick_publish" || body.snapshot.intentKind === "purchase_interest"
                ? body.snapshot.intentKind
                : undefined,
            saleMode: typeof body.snapshot.saleMode === "string" ? body.snapshot.saleMode : undefined,
            crowdfundingTargetPeople:
              typeof body.snapshot.crowdfundingTargetPeople === "number"
                ? body.snapshot.crowdfundingTargetPeople
                : undefined,
            uiContext:
              body.snapshot.uiContext && typeof body.snapshot.uiContext === "object"
                ? body.snapshot.uiContext
                : undefined
          }
        : undefined
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "意向单更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
