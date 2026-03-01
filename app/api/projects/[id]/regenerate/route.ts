import { NextResponse } from "next/server";
import { regenerateProjectOutputByModeForDemoUser } from "@/services/project-service";
import { isGenerationMode } from "@/types/generation-mode";

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
      return NextResponse.json({ error: "演示项目不支持重新生成。" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
    const mode = isGenerationMode(body?.mode) ? body?.mode : undefined;

    const result = await regenerateProjectOutputByModeForDemoUser({
      projectId: id,
      mode
    });

    return NextResponse.json({
      ok: true,
      usedFallbackOutput: result.usedFallbackOutput,
      warning: result.warning
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
