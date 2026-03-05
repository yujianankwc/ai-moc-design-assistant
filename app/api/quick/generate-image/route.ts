import { NextResponse } from "next/server";
import {
  buildQuickGenerationSummary,
  buildQuickKnowledgePack,
  decideQuickImageMode
} from "@/lib/quick-generation-pipeline";
import { generateQuickPreviewImage, isImageGenerationUpstreamError } from "@/services/ai-quick-image";
import { updateQuickProjectImageForDemoUser } from "@/services/project-service";
import type { QuickDirection, QuickEntryInput, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

type QuickGenerateImageBody = {
  idea?: string;
  direction?: QuickDirection | "";
  style?: QuickStyle | "";
  scale?: QuickScalePreference | "";
  referenceImage?: string;
  correctionIntent?: string;
  regenerateToken?: string;
  quickProjectId?: string;
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

const FALLBACK_MAX_RETRIES = 3;
const FALLBACK_RETRY_DELAY_MS = 3000;
const PRIMARY_RETRY_WITH_REF_IMAGE = 2;
const PRIMARY_RETRY_DELAY_MS = 4000;

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
    return "现在设计积木的人太多了，AI 设计师忙不过来，稍后去项目列表看看，我们一定会帮你设计出来。";
  }
  if (raw.includes("used_up") || raw.toLowerCase().includes("balance is not sufficient")) {
    return "AI 积木设计师今天的设计配额用完了，正在补充中，请稍后再来试试。";
  }
  if (
    raw.includes("No available channel") ||
    raw.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "大家都在设计自己的积木创意，AI 设计师正忙着赶稿，请稍后去项目列表查看。";
  }
  if (
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("timeout") ||
    raw.includes("AbortError") ||
    lowerRaw.includes("aborted")
  ) {
    return "这个创意有点复杂，AI 设计师还在琢磨中，稍后去项目列表看看，我们会帮你设计好的。";
  }
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) {
    return "设计参数需要调整一下，我们已经记录下来了，请再试一次。";
  }
  return "AI 积木设计师暂时忙不过来，稍后去项目列表查看，我们一定会帮你设计出来。";
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
  upstreamTraceId?: string;
  upstreamRequestId?: string;
  upstreamLogId?: string;
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

function extractUpstreamIds(error: unknown): {
  upstreamTraceId?: string;
  upstreamRequestId?: string;
  upstreamLogId?: string;
} {
  if (isImageGenerationUpstreamError(error)) {
    return {
      upstreamTraceId: error.traceId,
      upstreamRequestId: error.requestId,
      upstreamLogId: error.logId
    };
  }
  const raw = error instanceof Error ? error.message : String(error || "");
  const traceMatch = raw.match(/"trace[_-]?id"\s*:\s*"([^"]+)"/i);
  const requestMatch = raw.match(/"(request[_-]?id|req[_-]?id)"\s*:\s*"([^"]+)"/i);
  const logMatch = raw.match(/"log[_-]?id"\s*:\s*"([^"]+)"/i);
  return {
    upstreamTraceId: traceMatch?.[1],
    upstreamRequestId: requestMatch?.[2],
    upstreamLogId: logMatch?.[1]
  };
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableImageErrorType(errorType: ImageErrorType) {
  return errorType !== "balance_insufficient" && errorType !== "invalid_parameter";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let aliasForLog: QuickImageAlias = "default";
  let usedReferenceImageForLog = false;
  let ideaLengthForLog = 0;
  let usedFallbackForLog = false;
  let quickProjectIdForPersist = "";
  let ideaForPersist = "";
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
    quickProjectIdForPersist = typeof body.quickProjectId === "string" ? body.quickProjectId.trim() : "";
    ideaForPersist = input.idea;
    let previewImageUrl = "";
    let usedFallbackToDefault = false;
    let referenceImageDropped = false;
    const regenToken = typeof body.regenerateToken === "string" ? body.regenerateToken : "";

    const primaryMaxAttempts = usedReferenceImage && requestedAlias !== "default"
      ? 1 + PRIMARY_RETRY_WITH_REF_IMAGE
      : 1;

    let primaryLastRaw = "";
    for (let attempt = 1; attempt <= primaryMaxAttempts; attempt += 1) {
      try {
        previewImageUrl = await generateQuickPreviewImage({
          summary,
          knowledge,
          imageMode,
          referenceImage: input.referenceImage,
          regenerateToken: regenToken,
          imageModelAlias: requestedAlias
        });
        break;
      } catch (error) {
        primaryLastRaw = error instanceof Error ? error.message : String(error || "");
        const upstreamIds = extractUpstreamIds(error);
        logImageGenerationEvent({
          phase: "primary_failed",
          alias: requestedAlias,
          errorType: classifyImageError(error),
          usedFallbackToDefault: false,
          usedReferenceImage,
          elapsedMs: Date.now() - startedAt,
          ideaLength,
          ...upstreamIds
        });
        if (attempt < primaryMaxAttempts && isRetriableImageErrorType(classifyImageError(error))) {
          await sleep(PRIMARY_RETRY_DELAY_MS);
          continue;
        }
        if (!shouldFallbackToDefault(primaryLastRaw, requestedAlias)) {
          throw error;
        }
      }
    }

    if (!previewImageUrl) {
      usedFallbackToDefault = true;
      usedFallbackForLog = true;
      let fallbackLastRaw = "";
      for (let attempt = 1; attempt <= FALLBACK_MAX_RETRIES; attempt += 1) {
        try {
          previewImageUrl = await generateQuickPreviewImage({
            summary,
            knowledge,
            imageMode,
            referenceImage: input.referenceImage,
            regenerateToken: regenToken,
            imageModelAlias: "default"
          });
          break;
        } catch (fallbackError) {
          const fallbackRaw = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || "");
          const fallbackErrorType = classifyImageError(fallbackError);
          const upstreamIds = extractUpstreamIds(fallbackError);
          fallbackLastRaw = fallbackRaw;
          logImageGenerationEvent({
            phase: "fallback_failed",
            alias: requestedAlias,
            errorType: fallbackErrorType,
            usedFallbackToDefault: true,
            usedReferenceImage,
            elapsedMs: Date.now() - startedAt,
            ideaLength,
            ...upstreamIds
          });
          const shouldRetry = attempt < FALLBACK_MAX_RETRIES && isRetriableImageErrorType(fallbackErrorType);
          if (!shouldRetry) {
            throw new Error(`fallback_exhausted; primary=${primaryLastRaw}; fallback=${fallbackRaw}`);
          }
          await sleep(FALLBACK_RETRY_DELAY_MS);
        }
      }
      if (!previewImageUrl) {
        throw new Error(`fallback_exhausted; primary=${primaryLastRaw}; fallback=${fallbackLastRaw || primaryLastRaw}`);
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

    let persistedToProject = false;
    const quickProjectId = quickProjectIdForPersist;
    if (quickProjectId) {
      try {
        await updateQuickProjectImageForDemoUser({
          projectId: quickProjectId,
          idea: input.idea,
          previewImageUrl,
          imageWarning: ""
        });
        persistedToProject = true;
      } catch (persistError) {
        console.warn(
          JSON.stringify({
            tag: "quick_image_generation_persist_failed",
            quickProjectId,
            message: persistError instanceof Error ? persistError.message : String(persistError || "")
          })
        );
      }
    }

    return NextResponse.json({
      previewImageUrl,
      usedFallbackToDefault,
      usedReferenceImage,
      referenceImageDropped,
      persistedToProject
    });
  } catch (error) {
    const errorType = classifyImageError(error);
    const retryable = isRetriableImageErrorType(errorType);
    const upstreamIds = extractUpstreamIds(error);
    logImageGenerationEvent({
      phase: "request_failed",
      alias: aliasForLog,
      errorType,
      usedFallbackToDefault: usedFallbackForLog,
      usedReferenceImage: usedReferenceImageForLog,
      elapsedMs: Date.now() - startedAt,
      ideaLength: ideaLengthForLog,
      ...upstreamIds
    });
    if (quickProjectIdForPersist && ideaForPersist) {
      try {
        await updateQuickProjectImageForDemoUser({
          projectId: quickProjectIdForPersist,
          idea: ideaForPersist,
          imageWarning: toFriendlyImageError(error)
        });
      } catch {
        // Ignore persist warning failure in error path.
      }
    }
    return NextResponse.json(
      {
        error: toFriendlyImageError(error),
        retryable
      },
      { status: 500 }
    );
  }
}

