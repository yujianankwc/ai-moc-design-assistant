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
  imageModelAlias?: "default" | "nano_banner" | "nano_banana";
};

type QuickImageAlias = "default" | "nano_banner" | "nano_banana";

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

function toFriendlyImageError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (raw.includes("used_up") || raw.toLowerCase().includes("balance is not sufficient")) {
    return "图片服务余额不足，请充值后重试。";
  }
  if (raw.includes("No available channel") || raw.includes("\"code\":\"api_error\"")) {
    return "当前图片通道繁忙，请稍后重试。";
  }
  if (raw.toLowerCase().includes("timed out") || raw.includes("AbortError")) {
    return "图片生成超时，请稍后重试。";
  }
  return "预览图生成失败，请稍后重试。";
}

function resolveAliasFromBody(body: QuickGenerateImageBody): QuickImageAlias {
  if (body.imageModelAlias === "nano_banner" || body.imageModelAlias === "nano_banana" || body.imageModelAlias === "default") {
    return body.imageModelAlias;
  }
  const envAlias = process.env.AI_IMAGE_DEFAULT_ALIAS;
  if (envAlias === "nano_banner" || envAlias === "nano_banana") return envAlias;
  return "default";
}

function shouldFallbackToDefault(rawError: string, alias: QuickImageAlias) {
  if (alias === "default") return false;
  const fallbackEnabled = process.env.AI_IMAGE_AUTO_FALLBACK_TO_DEFAULT !== "false";
  if (!fallbackEnabled) return false;
  return (
    rawError.includes("No available channel") ||
    rawError.includes("\"code\":\"api_error\"") ||
    rawError.toLowerCase().includes("timed out")
  );
}

function hasReferenceImage(input: QuickEntryInput) {
  const value = input.referenceImage?.trim() || "";
  return value.startsWith("http://") || value.startsWith("https://");
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
    const requestedAlias = resolveAliasFromBody(body);
    const usedReferenceImage = hasReferenceImage(input);
    let previewImageUrl = "";
    let usedFallbackToDefault = false;
    try {
      previewImageUrl = await generateQuickPreviewImage({
        summary,
        knowledge,
        imageMode,
        referenceImage: input.referenceImage,
        regenerateToken: typeof body.regenerateToken === "string" ? body.regenerateToken : "",
        imageModelAlias: requestedAlias
      });
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error || "");
      if (shouldFallbackToDefault(rawError, requestedAlias)) {
        usedFallbackToDefault = true;
        previewImageUrl = await generateQuickPreviewImage({
          summary,
          knowledge,
          imageMode,
          referenceImage: input.referenceImage,
          regenerateToken: typeof body.regenerateToken === "string" ? body.regenerateToken : "",
          imageModelAlias: "default"
        });
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      previewImageUrl,
      usedFallbackToDefault,
      usedReferenceImage
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: toFriendlyImageError(error)
      },
      { status: 500 }
    );
  }
}

