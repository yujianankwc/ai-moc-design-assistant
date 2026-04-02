import { NextResponse } from "next/server";
import { getQuickImageTimeoutMs } from "@/services/ai-quick-image";
import {
  getQuickProjectByIdForCurrentVisitor,
  updateQuickProjectImageForCurrentVisitor
} from "@/services/project-service";
import type { QuickImageModelAlias, QuickImageStatus } from "@/types/quick-entry";

type UpdateImageBody = {
  idea?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
  imageStatus?: QuickImageStatus;
  imageUpdatedAt?: string | null;
  imageLastError?: string;
  imageAttemptCount?: number;
  imageModelAlias?: QuickImageModelAlias | null;
};

function getImageStaleAfterMs(alias: QuickImageModelAlias | null) {
  const requestTimeoutMs = getQuickImageTimeoutMs(alias ?? "default");
  return Math.max(requestTimeoutMs + 30_000, 120_000);
}

function isStaleGeneratingProject(input: {
  imageStatus: QuickImageStatus;
  imageUpdatedAt: string | null;
  imageModelAlias: QuickImageModelAlias | null;
}) {
  if (input.imageStatus !== "queued" && input.imageStatus !== "generating") return false;
  if (!input.imageUpdatedAt) return false;
  const updatedAtMs = new Date(input.imageUpdatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;
  return Date.now() - updatedAtMs > getImageStaleAfterMs(input.imageModelAlias);
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    let quickProject = await getQuickProjectByIdForCurrentVisitor(id);
    if (!quickProject) {
      return NextResponse.json({ error: "未找到轻量项目。" }, { status: 404 });
    }

    if (
      isStaleGeneratingProject({
        imageStatus: quickProject.imageStatus,
        imageUpdatedAt: quickProject.imageUpdatedAt,
        imageModelAlias: quickProject.imageModelAlias
      })
    ) {
      await updateQuickProjectImageForCurrentVisitor({
        projectId: id,
        idea: quickProject.input.idea,
        previewImageUrl: null,
        imageWarning: "这次预览图整理超时了，请再试一次。",
        imageStatus: "failed",
        imageLastError: "这次预览图整理超时了，请再试一次。",
        imageAttemptCount: quickProject.imageAttemptCount,
        imageModelAlias: quickProject.imageModelAlias
      });
      quickProject = await getQuickProjectByIdForCurrentVisitor(id);
      if (!quickProject) {
        return NextResponse.json({ error: "未找到轻量项目。" }, { status: 404 });
      }
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

    await updateQuickProjectImageForCurrentVisitor({
      projectId: id,
      idea,
      previewImageUrl: typeof body.previewImageUrl === "string" ? body.previewImageUrl : body.previewImageUrl === null ? null : undefined,
      imageWarning: typeof body.imageWarning === "string" ? body.imageWarning : undefined,
      imageStatus:
        body.imageStatus === "idle" ||
        body.imageStatus === "queued" ||
        body.imageStatus === "generating" ||
        body.imageStatus === "succeeded" ||
        body.imageStatus === "failed"
          ? body.imageStatus
          : undefined,
      imageUpdatedAt: typeof body.imageUpdatedAt === "string" ? body.imageUpdatedAt : undefined,
      imageLastError: typeof body.imageLastError === "string" ? body.imageLastError : undefined,
      imageAttemptCount: typeof body.imageAttemptCount === "number" ? body.imageAttemptCount : undefined,
      imageModelAlias:
        body.imageModelAlias === "default" || body.imageModelAlias === "nano_banner" || body.imageModelAlias === "nano_banana"
          ? body.imageModelAlias
          : body.imageModelAlias === null
            ? null
            : undefined
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "轻量项目更新失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
