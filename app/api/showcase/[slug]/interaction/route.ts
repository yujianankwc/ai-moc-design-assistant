import { NextResponse } from "next/server";
import {
  getShowcaseInteractionSummary,
  setShowcaseInteractionForVisitor,
  type ShowcaseInteractionAction
} from "@/services/project-service";

type Body = {
  actionType?: ShowcaseInteractionAction;
  active?: boolean;
};

function isActionType(value: string): value is ShowcaseInteractionAction {
  return value === "like" || value === "watch";
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const summary = await getShowcaseInteractionSummary(slug);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开展示互动读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as Body;
    const actionType = String(body?.actionType || "");
    if (!isActionType(actionType) || typeof body?.active !== "boolean") {
      return NextResponse.json({ error: "公开展示互动参数不完整。" }, { status: 400 });
    }

    const summary = await setShowcaseInteractionForVisitor({
      showcaseKey: slug,
      actionType,
      active: body.active
    });
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开展示互动更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
