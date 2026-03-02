import { NextResponse } from "next/server";
import {
  buildQuickGenerationSummary,
  buildQuickKnowledgePack,
  decideQuickImageMode
} from "@/lib/quick-generation-pipeline";
import { generateQuickPreviewImage } from "@/services/ai-quick-image";
import type { QuickDirection, QuickEntryInput, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

type QuickGenerateImageBody = {
  idea?: string;
  direction?: QuickDirection | "";
  style?: QuickStyle | "";
  scale?: QuickScalePreference | "";
  referenceImage?: string;
  correctionIntent?: string;
  regenerateToken?: string;
};

function sanitizeInput(body: QuickGenerateImageBody): QuickEntryInput | null {
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (!idea) return null;

  const direction =
    body.direction === "display" || body.direction === "cost" || body.direction === "production" ? body.direction : "";
  const style =
    body.style === "cute" || body.style === "mechanical" || body.style === "realistic" || body.style === "fantasy"
      ? body.style
      : "";
  const scale = body.scale === "small" || body.scale === "medium" || body.scale === "large" ? body.scale : "";

  return {
    idea,
    direction,
    style,
    scale,
    referenceImage: typeof body.referenceImage === "string" ? body.referenceImage.trim() : "",
    correctionIntent: typeof body.correctionIntent === "string" ? body.correctionIntent.trim() : ""
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuickGenerateImageBody;
    const input = sanitizeInput(body);
    if (!input) {
      return NextResponse.json({ error: "缺少创意输入，无法生成预览图。" }, { status: 400 });
    }

    const summary = buildQuickGenerationSummary(input);
    const knowledge = buildQuickKnowledgePack(summary);
    const imageMode = decideQuickImageMode(summary);
    const previewImageUrl = await generateQuickPreviewImage({
      summary,
      knowledge,
      imageMode,
      referenceImage: input.referenceImage,
      regenerateToken: typeof body.regenerateToken === "string" ? body.regenerateToken : ""
    });

    return NextResponse.json({
      previewImageUrl
    });
  } catch {
    return NextResponse.json(
      {
        error: "预览图生成失败，请稍后重试。"
      },
      { status: 500 }
    );
  }
}

