import { NextResponse } from "next/server";
import { moderateQuickGenerationInput } from "@/lib/content-moderation";
import {
  buildQuickGenerationSummary,
  buildQuickKnowledgePack,
  decideQuickImageMode
} from "@/lib/quick-generation-pipeline";
import {
  generateQuickPreviewImage,
  isImageGenerationUpstreamError,
  type GenerateQuickPreviewImageResult
} from "@/services/ai-quick-image";
import {
  getQuickProjectByIdForCurrentVisitor,
  markQuickProjectModerationBlockedForCurrentVisitor,
  reviewQuickProjectForPublicPublishForCurrentVisitor,
  updateQuickProjectImageForCurrentVisitor
} from "@/services/project-service";
import type {
  QuickDirection,
  QuickEntryInput,
  QuickImageModelAlias,
  QuickScalePreference,
  QuickStyle
} from "@/types/quick-entry";

type QuickGenerateImageBody = {
  idea?: string;
  direction?: QuickDirection | "";
  style?: QuickStyle | "";
  scale?: QuickScalePreference | "";
  referenceImage?: string;
  correctionIntent?: string;
  regenerateToken?: string;
  quickProjectId?: string;
  imageModelAlias?: QuickImageModelAlias;
};

type QuickImageAlias = QuickImageModelAlias;

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
    return "这次预览图还没整理出来，可以稍后再试一次。";
  }
  if (raw.includes("used_up") || lowerRaw.includes("balance is not sufficient")) {
    return "当前预览图配额比较紧张，请稍后再试。";
  }
  if (
    raw.includes("No available channel") ||
    raw.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "当前生成通道有点拥挤，这次预览图没出来，请稍后再试。";
  }
  if (
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("timeout") ||
    raw.includes("AbortError") ||
    lowerRaw.includes("aborted")
  ) {
    return "这次预览图整理超时了，请再试一次。";
  }
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) {
    return "这次设计参数没对上，请再试一次。";
  }
  return "这次预览图还没整理出来，请再试一次。";
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

function isSafetyBlockedImageError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  return /(content policy|safety|unsafe|nsfw|sexual|nudity|裸体|裸露|色情)/i.test(raw);
}

function inferFinalModelAlias(input: {
  requestedAlias: QuickImageAlias;
  usedFallbackToDefault: boolean;
  referenceImageDropped: boolean;
  usedReferenceImage: boolean;
}): QuickImageAlias {
  if (input.usedFallbackToDefault) return "default";
  if (input.usedReferenceImage && input.referenceImageDropped) return "default";
  return input.requestedAlias;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let aliasForLog: QuickImageAlias = "default";
  let usedReferenceImageForLog = false;
  let ideaLengthForLog = 0;
  let usedFallbackForLog = false;
  let quickProjectIdForPersist = "";
  let ideaForPersist = "";
  let nextAttemptCount = 0;
  let finalModelAlias: QuickImageAlias = "default";

  try {
    const body = (await request.json()) as QuickGenerateImageBody;
    const input = sanitizeInput(body);
    if (!input) {
      return NextResponse.json({ status: "failed", message: "缺少创意输入，无法生成预览图。", retryable: false }, { status: 400 });
    }
    const inputModeration = moderateQuickGenerationInput(input);
    if (inputModeration.status === "block") {
      if (typeof body.quickProjectId === "string" && body.quickProjectId.trim()) {
        await markQuickProjectModerationBlockedForCurrentVisitor({
          projectId: body.quickProjectId.trim(),
          idea: input.idea,
          reason: inputModeration.reason || "policy_blocked_publish"
        });
      }
      return NextResponse.json(
        {
          status: "failed",
          previewImageUrl: null,
          message: "这条内容不适合继续生成图片，请换个方向试试。",
          retryable: false,
          moderationStatus: "block",
          publishEligibility: "private_draft",
          imageModerationStatus: "blocked"
        },
        { status: 400 }
      );
    }

    const summary = buildQuickGenerationSummary(input);
    const knowledge = buildQuickKnowledgePack(summary);
    const imageMode = decideQuickImageMode(summary);
    const requestedAlias = resolveAliasFromBody(body);
    const usedReferenceImage = hasReferenceImage(input);
    const ideaLength = input.idea.length;
    const quickProjectId = typeof body.quickProjectId === "string" ? body.quickProjectId.trim() : "";
    const regenToken = typeof body.regenerateToken === "string" ? body.regenerateToken : "";

    aliasForLog = requestedAlias;
    usedReferenceImageForLog = usedReferenceImage;
    ideaLengthForLog = ideaLength;
    quickProjectIdForPersist = quickProjectId;
    ideaForPersist = input.idea;

    if (quickProjectId) {
      const existingProject = await getQuickProjectByIdForCurrentVisitor(quickProjectId);
      nextAttemptCount = (existingProject?.imageAttemptCount ?? 0) + 1;
      await updateQuickProjectImageForCurrentVisitor({
        projectId: quickProjectId,
        idea: input.idea,
        previewImageUrl: null,
        imageWarning: "",
        imageStatus: "generating",
        imageLastError: "",
        imageAttemptCount: nextAttemptCount,
        imageModelAlias: requestedAlias,
        imageModerationStatus: "pending"
      });
    }

    let previewImageUrl = "";
    let usedFallbackToDefault = false;
    let referenceImageDropped = false;
    const primaryMaxAttempts = usedReferenceImage && requestedAlias !== "default" ? 1 + PRIMARY_RETRY_WITH_REF_IMAGE : 1;

    let primaryLastRaw = "";
    let primaryResult: GenerateQuickPreviewImageResult | null = null;
    for (let attempt = 1; attempt <= primaryMaxAttempts; attempt += 1) {
      try {
        primaryResult = await generateQuickPreviewImage({
          summary,
          knowledge,
          imageMode,
          referenceImage: input.referenceImage,
          regenerateToken: regenToken,
          imageModelAlias: requestedAlias
        });
        previewImageUrl = primaryResult.url;
        if (usedReferenceImage && !primaryResult.referenceImageUsed) {
          referenceImageDropped = true;
        }
        break;
      } catch (error) {
        primaryLastRaw = error instanceof Error ? error.message : String(error || "");
        logImageGenerationEvent({
          phase: "primary_failed",
          alias: requestedAlias,
          errorType: classifyImageError(error),
          usedFallbackToDefault: false,
          usedReferenceImage,
          elapsedMs: Date.now() - startedAt,
          ideaLength,
          ...extractUpstreamIds(error)
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
      let fallbackResult: GenerateQuickPreviewImageResult | null = null;
      for (let attempt = 1; attempt <= FALLBACK_MAX_RETRIES; attempt += 1) {
        try {
          fallbackResult = await generateQuickPreviewImage({
            summary,
            knowledge,
            imageMode,
            referenceImage: input.referenceImage,
            regenerateToken: regenToken,
            imageModelAlias: "default"
          });
          previewImageUrl = fallbackResult.url;
          if (usedReferenceImage && !fallbackResult.referenceImageUsed) {
            referenceImageDropped = true;
          }
          break;
        } catch (fallbackError) {
          fallbackLastRaw = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || "");
          const fallbackErrorType = classifyImageError(fallbackError);
          logImageGenerationEvent({
            phase: "fallback_failed",
            alias: requestedAlias,
            errorType: fallbackErrorType,
            usedFallbackToDefault: true,
            usedReferenceImage,
            elapsedMs: Date.now() - startedAt,
            ideaLength,
            ...extractUpstreamIds(fallbackError)
          });
          const shouldRetry = attempt < FALLBACK_MAX_RETRIES && isRetriableImageErrorType(fallbackErrorType);
          if (!shouldRetry) {
            throw new Error(`fallback_exhausted; primary=${primaryLastRaw}; fallback=${fallbackLastRaw}`);
          }
          await sleep(FALLBACK_RETRY_DELAY_MS);
        }
      }
      if (!previewImageUrl) {
        throw new Error(`fallback_exhausted; primary=${primaryLastRaw}; fallback=${fallbackLastRaw || primaryLastRaw}`);
      }
    }

    finalModelAlias = inferFinalModelAlias({
      requestedAlias,
      usedFallbackToDefault,
      referenceImageDropped,
      usedReferenceImage
    });

    logImageGenerationEvent({
      phase: "request_succeeded",
      alias: requestedAlias,
      usedFallbackToDefault,
      usedReferenceImage,
      elapsedMs: Date.now() - startedAt,
      ideaLength
    });

    let persistedToProject = false;
    let reviewResult:
      | Awaited<ReturnType<typeof reviewQuickProjectForPublicPublishForCurrentVisitor>>
      | null = null;
    if (quickProjectId) {
      await updateQuickProjectImageForCurrentVisitor({
        projectId: quickProjectId,
        idea: input.idea,
        previewImageUrl,
        imageWarning: "",
        imageStatus: "succeeded",
        imageLastError: "",
        imageAttemptCount: nextAttemptCount,
        imageModelAlias: finalModelAlias
      });
      reviewResult = await reviewQuickProjectForPublicPublishForCurrentVisitor({
        projectId: quickProjectId
      });
      persistedToProject = true;
    }

    return NextResponse.json({
      status: "succeeded",
      previewImageUrl,
      message: "预览图已整理完成。",
      retryable: false,
      usedFallbackToDefault,
      usedReferenceImage,
      referenceImageDropped,
      persistedToProject,
      moderationStatus: reviewResult?.moderationStatus ?? "allow",
      moderationReason: reviewResult?.moderationReason ?? "",
      publishEligibility: reviewResult?.publishEligibility ?? "private_draft",
      imageModerationStatus: reviewResult?.imageModerationStatus ?? "pending"
    });
  } catch (error) {
    const errorType = classifyImageError(error);
    const retryable = isRetriableImageErrorType(errorType);
    const message = toFriendlyImageError(error);
    logImageGenerationEvent({
      phase: "request_failed",
      alias: aliasForLog,
      errorType,
      usedFallbackToDefault: usedFallbackForLog,
      usedReferenceImage: usedReferenceImageForLog,
      elapsedMs: Date.now() - startedAt,
      ideaLength: ideaLengthForLog,
      ...extractUpstreamIds(error)
    });

    if (quickProjectIdForPersist && ideaForPersist) {
      const moderationReason = isSafetyBlockedImageError(error)
        ? "image_upstream_safety_block"
        : undefined;
      await updateQuickProjectImageForCurrentVisitor({
        projectId: quickProjectIdForPersist,
        idea: ideaForPersist,
        previewImageUrl: null,
        imageWarning: message,
        imageStatus: "failed",
        imageLastError: message,
        imageAttemptCount: nextAttemptCount,
        imageModelAlias: usedFallbackForLog ? "default" : aliasForLog,
        imageModerationStatus: moderationReason ? "blocked" : "pending",
        moderationStatus: moderationReason ? "block" : undefined,
        moderationReason: moderationReason ?? undefined,
        publishEligibility: moderationReason ? "private_draft" : undefined,
        lastModeratedAt: moderationReason ? new Date().toISOString() : undefined
      });
    }

    return NextResponse.json(
      {
        status: "failed",
        previewImageUrl: null,
        message,
        retryable,
        usedFallbackToDefault: usedFallbackForLog,
        usedReferenceImage: usedReferenceImageForLog,
        referenceImageDropped: false,
        moderationStatus: isSafetyBlockedImageError(error) ? "block" : "allow",
        publishEligibility: "private_draft",
        imageModerationStatus: isSafetyBlockedImageError(error) ? "blocked" : "pending"
      },
      { status: 500 }
    );
  }
}
