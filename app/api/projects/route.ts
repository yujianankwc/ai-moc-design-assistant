import { NextResponse } from "next/server";
import { createProjectAndMaybeOutputForCurrentVisitor } from "@/services/project-service";
import type { ProjectFormPayload, ProjectStatus } from "@/types/project";

type CreateProjectBody = {
  status: ProjectStatus;
  payload: ProjectFormPayload;
};

function isValidStatus(value: string): value is ProjectStatus {
  return value === "draft" || value === "generating";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateProjectBody;

    if (!body || !isValidStatus(body.status) || !body.payload) {
      return NextResponse.json({ error: "请求参数不完整" }, { status: 400 });
    }

    const created = await createProjectAndMaybeOutputForCurrentVisitor({
      status: body.status,
      payload: body.payload
    });

    return NextResponse.json({
      projectId: created.id,
      usedFallbackOutput: created.usedFallbackOutput,
      warning: created.warning
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "写库失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
