import { NextResponse } from "next/server";
import {
  getQuickProjectByIdForDemoUser,
  updateQuickProjectImageForDemoUser
} from "@/services/project-service";

type UpdateImageBody = {
  idea?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
};

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const quickProject = await getQuickProjectByIdForDemoUser(id);
    if (!quickProject) {
      return NextResponse.json({ error: "未找到轻量项目。" }, { status: 404 });
    }
    return NextResponse.json({ quickProject });
  } catch (error) {
    const message = error instanceof Error ? error.message : "轻量项目读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as UpdateImageBody;
    const idea = typeof body.idea === "string" ? body.idea.trim() : undefined;

    await updateQuickProjectImageForDemoUser({
      projectId: id,
      idea,
      previewImageUrl: typeof body.previewImageUrl === "string" ? body.previewImageUrl : null,
      imageWarning: typeof body.imageWarning === "string" ? body.imageWarning : ""
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "轻量项目更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
