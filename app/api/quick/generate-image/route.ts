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

type ImageErrorType =
  | "balance_insufficient"
  | "channel_busy"
  | "timeout"
  | "fallback_exhausted"
  | "invalid_parameter"
  | "api_error"
  | "unknown";

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
  const lowerRaw = raw.toLowerCase();
  if (lowerRaw.includes("fallback_exhausted")) {
    return "当前图片通道波动较大，已自动切换备用模型但仍未成功，请稍后重试。";
  }
  if (raw.includes("used_up") || raw.toLowerCase().includes("balance is not sufficient")) {
    return "图片服务余额不足，请充值后重试。";
  }
  if (
    raw.includes("No available channel") ||
    raw.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "当前图片通道繁忙，请稍后重试。";
  }
  if (
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("timeout") ||
    raw.includes("AbortError") ||
    lowerRaw.includes("aborted")
  ) {
    return "图片生成超时，请稍后重试。";
  }
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) {
    return "图片尺寸配置不兼容，已记录为配置问题，请稍后再试。";
  }
  return "预览图生成失败，请稍后重试。";
}

function classifyImageError(error: unknown): ImageErrorType {
  const raw = error instanceof Error ? error.message : String(error || "");
  const lowerRaw = raw.toLowerCase();
  if (lowerRaw.includes("fallback_exhausted")) return "fallback_exhausted";
  if (raw.includes("used_up") || lowerRaw.includes("balance is not sufficient")) return "balance_insufficient";
  if (
    raw.includes("No available channel") ||
    raw.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "channel_busy";
  }
  if (lowerRaw.includes("timed out") || lowerRaw.includes("timeout") || raw.includes("AbortError") || lowerRaw.includes("aborted")) {
    return "timeout";
  }
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) {
    return "invalid_parameter";
  }
  if (lowerRaw.includes("api_error")) return "api_error";
  return "unknown";
}

function logImageGenerationEvent(input: {
  phase: "primary_failed" | "fallback_failed" | "request_failed" | "request_succeeded";
  alias: QuickImageAlias;
  errorType?: ImageErrorType;
  usedFallbackToDefault: boolean;
  usedReferenceImage: boolean;
  elapsedMs: number;
  ideaLength: number;
}) {
  const payload = {
    tag: "quick_image_generation",
    ...input
  };
  if (input.phase === "request_succeeded") {
    console.info(JSON.stringify(payload));
    return;
  }
  console.warn(JSON.stringify(payload));
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
  const lowerRaw = rawError.toLowerCase();
  const hasServerError = /\b5\d\d\b/.test(rawError);
  return (
    rawError.includes("No available channel") ||
    rawError.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("timeout") ||
    lowerRaw.includes("aborted") ||
    lowerRaw.includes("aborterror") ||
    lowerRaw.includes("service unavailable") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("channel_busy") ||
    hasServerError
  );
}

function hasReferenceImage(input: QuickEntryInput) {
  const value = input.referenceImage?.trim() || "";
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let aliasForLog: QuickImageAlias = "default";
  let usedReferenceImageForLog = false;
  let ideaLengthForLog = 0;
  let usedFallbackForLog = false;
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
    const ideaLength = input.idea.length;
    aliasForLog = requestedAlias;
    usedReferenceImageForLog = usedReferenceImage;
    ideaLengthForLog = ideaLength;
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
      logImageGenerationEvent({
        phase: "primary_failed",
        alias: requestedAlias,
        errorType: classifyImageError(error),
        usedFallbackToDefault: false,
        usedReferenceImage,
        elapsedMs: Date.now() - startedAt,
        ideaLength
      });
      if (shouldFallbackToDefault(rawError, requestedAlias)) {
        usedFallbackToDefault = true;
        usedFallbackForLog = true;
        try {
          previewImageUrl = await generateQuickPreviewImage({
            summary,
            knowledge,
            imageMode,
            referenceImage: input.referenceImage,
            regenerateToken: typeof body.regenerateToken === "string" ? body.regenerateToken : "",
            imageModelAlias: "default"
          });
        } catch (fallbackError) {
          const fallbackRaw = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || "");
          logImageGenerationEvent({
            phase: "fallback_failed",
            alias: requestedAlias,
            errorType: classifyImageError(fallbackError),
            usedFallbackToDefault: true,
            usedReferenceImage,
            elapsedMs: Date.now() - startedAt,
            ideaLength
          });
          throw new Error(`fallback_exhausted; primary=${rawError}; fallback=${fallbackRaw}`);
        }
      } else {
        throw error;
      }
    }

    logImageGenerationEvent({
      phase: "request_succeeded",
      alias: requestedAlias,
      usedFallbackToDefault,
      usedReferenceImage,
      elapsedMs: Date.now() - startedAt,
      ideaLength
    });

    return NextResponse.json({
      previewImageUrl,
      usedFallbackToDefault,
      usedReferenceImage
    });
  } catch (error) {
    logImageGenerationEvent({
      phase: "request_failed",
      alias: aliasForLog,
      errorType: classifyImageError(error),
      usedFallbackToDefault: usedFallbackForLog,
      usedReferenceImage: usedReferenceImageForLog,
      elapsedMs: Date.now() - startedAt,
      ideaLength: ideaLengthForLog
    });
    return NextResponse.json(
      {
        error: toFriendlyImageError(error)
      },
      { status: 500 }
    );
  }
}

