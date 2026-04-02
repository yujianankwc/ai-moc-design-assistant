import { NextResponse } from "next/server";
import {
  createQuickProjectForCurrentVisitor,
  updateQuickProjectResultForCurrentVisitor
} from "@/services/project-service";
import {
  buildQuickGenerationSummary,
  buildQuickKnowledgePack,
  buildRuleBasedQuickResultFromSummary,
  postProcessQuickCopy
} from "@/lib/quick-generation-pipeline";
import { generateQuickCopyWithAI } from "@/services/ai-quick-copy";
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
          textWarning,
          resetImage: Boolean(regenerateToken)
        })
      : await createQuickProjectForCurrentVisitor({
          quickInput: input,
          quickResult: result,
          textWarning
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
