import { NextResponse } from "next/server";
import { updateManualEditForCurrentVisitor } from "@/services/project-service";

type Params = {
  params: Promise<{ id: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request, context: Params) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "演示项目不支持保存人工编辑内容。" }, { status: 400 });
    }

    const body = (await request.json()) as { manualEditContent?: string };
    const content = typeof body?.manualEditContent === "string" ? body.manualEditContent : "";

    await updateManualEditForCurrentVisitor({
      projectId: id,
      manualEditContent: content
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
