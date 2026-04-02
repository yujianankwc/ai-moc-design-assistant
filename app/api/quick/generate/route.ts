import { NextResponse } from "next/server";
import {
  createQuickProjectForCurrentVisitor,
  updateQuickProjectResultForCurrentVisitor
} from "@/services/project-service";
import {
  buildQuickGenerationSummary,
  buildQuickKnowledgePack,
  buildRuleBasedQuickResultFromSummary,
  decideQuickImageMode,
  postProcessQuickCopy
} from "@/lib/quick-generation-pipeline";
import { generateQuickCopyWithAI } from "@/services/ai-quick-copy";
import { generateQuickPreviewImage } from "@/services/ai-quick-image";
import { updateQuickProjectImageForCurrentVisitor } from "@/services/project-service";
import type { QuickDirection, QuickEntryInput, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

type QuickGenerateBody = {
  idea?: string;
  direction?: QuickDirection | "";
  style?: QuickStyle | "";
  scale?: QuickScalePreference | "";
  referenceImage?: string;
  correctionIntent?: string;
  quickProjectId?: string;
  regenerateToken?: string;
};

type QuickImageAlias = "default" | "nano_banner" | "nano_banana";

const BACKFILL_FALLBACK_MAX_RETRIES = 3;
const BACKFILL_FALLBACK_RETRY_DELAY_MS = 3000;
const BACKFILL_INITIAL_DELAY_MS = 15_000;

function sanitizeInput(body: QuickGenerateBody): QuickEntryInput | null {
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

function resolveDefaultImageAlias(): QuickImageAlias {
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

function classifyErrorType(rawError: string) {
  const lowerRaw = rawError.toLowerCase();
  if (rawError.includes("used_up") || lowerRaw.includes("balance is not sufficient")) return "balance_insufficient";
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) return "invalid_parameter";
  if (
    rawError.includes("No available channel") ||
    rawError.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "channel_busy";
  }
  if (lowerRaw.includes("timed out") || lowerRaw.includes("timeout") || rawError.includes("AbortError") || lowerRaw.includes("aborted")) {
    return "timeout";
  }
  return "unknown";
}

function isRetriableError(rawError: string) {
  const type = classifyErrorType(rawError);
  return type !== "balance_insufficient" && type !== "invalid_parameter";
}

function toFriendlyImageError(rawError: string) {
  const lowerRaw = rawError.toLowerCase();
  if (lowerRaw.includes("fallback_exhausted")) {
    return "当前结果还在整理中，建议稍后去项目列表继续查看。";
  }
  if (rawError.includes("used_up") || lowerRaw.includes("balance is not sufficient")) {
    return "当前生成配额较紧张，建议稍后再试，或先去项目列表查看已有结果。";
  }
  if (
    rawError.includes("No available channel") ||
    rawError.includes("\"code\":\"api_error\"") ||
    lowerRaw.includes("channel busy") ||
    lowerRaw.includes("service unavailable")
  ) {
    return "当前有较多创意正在排队整理，建议稍后去项目列表查看。";
  }
  if (
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("timeout") ||
    rawError.includes("AbortError") ||
    lowerRaw.includes("aborted")
  ) {
    return "这个创意还在继续整理中，稍后去项目列表查看会更稳妥。";
  }
  if (lowerRaw.includes("invalidparameter") || lowerRaw.includes("parameter `size` specified")) {
    return "设计参数需要调整一下，我们已经记录下来了，请再试一次。";
  }
  return "当前结果正在整理中，建议稍后去项目列表继续查看。";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function projectAlreadyHasImage(projectId: string): Promise<boolean> {
  try {
    const { getQuickProjectByIdForCurrentVisitor } = await import("@/services/project-service");
    const project = await getQuickProjectByIdForCurrentVisitor(projectId);
    return Boolean(project?.previewImageUrl);
  } catch {
    return false;
  }
}

async function generateAndPersistQuickImageInBackground(input: {
  projectId: string;
  quickInput: QuickEntryInput;
  summary: ReturnType<typeof buildQuickGenerationSummary>;
  knowledge: ReturnType<typeof buildQuickKnowledgePack>;
  regenerateToken: string;
}) {
  await sleep(BACKFILL_INITIAL_DELAY_MS);

  if (await projectAlreadyHasImage(input.projectId)) return;

  const alias = resolveDefaultImageAlias();
  const imageMode = decideQuickImageMode(input.summary);
  try {
    let previewImageUrl = "";
    try {
      const result = await generateQuickPreviewImage({
        summary: input.summary,
        knowledge: input.knowledge,
        imageMode,
        referenceImage: input.quickInput.referenceImage,
        regenerateToken: input.regenerateToken,
        imageModelAlias: alias
      });
      previewImageUrl = result.url;
    } catch (error) {
      const rawError = error instanceof Error ? error.message : String(error || "");
      if (!shouldFallbackToDefault(rawError, alias)) {
        throw error;
      }
      let fallbackRaw = rawError;
      for (let attempt = 1; attempt <= BACKFILL_FALLBACK_MAX_RETRIES; attempt += 1) {
        try {
          const result = await generateQuickPreviewImage({
            summary: input.summary,
            knowledge: input.knowledge,
            imageMode,
            referenceImage: input.quickInput.referenceImage,
            regenerateToken: input.regenerateToken,
            imageModelAlias: "default"
          });
          previewImageUrl = result.url;
          break;
        } catch (fallbackError) {
          fallbackRaw = fallbackError instanceof Error ? fallbackError.message : String(fallbackError || "");
          const shouldRetry = attempt < BACKFILL_FALLBACK_MAX_RETRIES && isRetriableError(fallbackRaw);
          if (!shouldRetry) {
            throw new Error(`fallback_exhausted; primary=${rawError}; fallback=${fallbackRaw}`);
          }
          await sleep(BACKFILL_FALLBACK_RETRY_DELAY_MS);
        }
      }
      if (!previewImageUrl) {
        throw new Error(`fallback_exhausted; primary=${rawError}; fallback=${fallbackRaw}`);
      }
    }

    if (!previewImageUrl) return;
    if (await projectAlreadyHasImage(input.projectId)) return;

    await updateQuickProjectImageForCurrentVisitor({
      projectId: input.projectId,
      idea: input.quickInput.idea,
      previewImageUrl,
      imageWarning: ""
    });
  } catch (error) {
    if (await projectAlreadyHasImage(input.projectId)) return;

    const rawError = error instanceof Error ? error.message : String(error || "");
    await updateQuickProjectImageForCurrentVisitor({
      projectId: input.projectId,
      idea: input.quickInput.idea,
      imageWarning: toFriendlyImageError(rawError)
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuickGenerateBody;
    const input = sanitizeInput(body);
    if (!input) {
      return NextResponse.json({ error: "请输入一句话创意。" }, { status: 400 });
    }

    const summary = buildQuickGenerationSummary(input);
    const knowledge = buildQuickKnowledgePack(summary);
    const ruleResult = buildRuleBasedQuickResultFromSummary({ summary, knowledge });

    if (process.env.NODE_ENV !== "production" && process.env.QUICK_DEBUG_SUMMARY === "1") {
      console.debug("[quick-summary]", {
        summary,
        knowledge: {
          themeTags: knowledge.themeTags,
          valueTags: knowledge.valueTags,
          riskTags: knowledge.riskTags,
          anchors: knowledge.anchors.map((item) => item.title)
        }
      });
    }

    let textWarning = "";
    let result = ruleResult;
    try {
      const regenerateToken = typeof body.regenerateToken === "string" ? body.regenerateToken : "";
      const aiCopy = await generateQuickCopyWithAI({
        summary,
        knowledge,
        regenerateToken
      });
      const processed = postProcessQuickCopy(aiCopy, summary);
      result = {
        ...ruleResult,
        topJudgement: processed.topJudgement || ruleResult.topJudgement,
        conceptPreview: processed.conceptPreview || ruleResult.conceptPreview,
        recommendedReason: processed.recommendedReason || ruleResult.recommendedReason
      };
    } catch (textError) {
      void textError;
      textWarning = "已先给出稳定方向结论，后续可继续细化。";
    }

    const quickProjectId = typeof body.quickProjectId === "string" ? body.quickProjectId.trim() : "";
    const regenerateToken = typeof body.regenerateToken === "string" ? body.regenerateToken : "";
    const createdQuickProject = quickProjectId
      ? await updateQuickProjectResultForCurrentVisitor({
          projectId: quickProjectId,
          quickInput: input,
          quickResult: result,
          textWarning
        })
      : await createQuickProjectForCurrentVisitor({
          quickInput: input,
          quickResult: result,
          textWarning
        });
    void generateAndPersistQuickImageInBackground({
      projectId: createdQuickProject.id,
      quickInput: input,
      summary,
      knowledge,
      regenerateToken
    });
    return NextResponse.json({
      input,
      result,
      textWarning,
      quickProjectId: createdQuickProject.id
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const normalized = rawMessage.toLowerCase();
    const message =
      normalized.includes("result is not defined") || normalized.includes("referenceerror")
        ? "AI 服务暂时波动，请稍后重试。"
        : rawMessage || "轻量生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
