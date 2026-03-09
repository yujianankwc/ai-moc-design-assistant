import { NextResponse } from "next/server";
import { getIntentDetailForDemoUser } from "@/services/project-service";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const detail = await getIntentDetailForDemoUser(id);
    if (!detail) {
      return NextResponse.json({ error: "未找到该意向单。" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "意向单详情读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

