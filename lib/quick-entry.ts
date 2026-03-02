import { pickSimilarReferences } from "@/lib/reference-matcher";
import type { ReferenceSample, ReferenceType } from "@/lib/reference-samples";
import type { GenerationMode } from "@/types/generation-mode";
import type { ProjectFormPayload } from "@/types/project";
import type {
  QuickDirection,
  QuickEntryInput,
  QuickEntryResult,
  QuickPath,
  QuickScalePreference,
  QuickStyle
} from "@/types/quick-entry";

export const QUICK_PREFILL_SESSION_KEY = "moc_quick_prefill_v1";
export const QUICK_AI_RESULT_SESSION_KEY = "moc_quick_ai_result_v1";

type QuickPrefillPayload = {
  idea: string;
  direction: QuickDirection | "";
  style: QuickStyle | "";
  scale?: QuickScalePreference | "";
  quickJudgement: string;
  quickPath: QuickPath;
};

function mapDirectionLabel(direction: QuickDirection | "") {
  if (direction === "display") return "展示感";
  if (direction === "cost") return "成本友好";
  if (direction === "production") return "可量产";
  return "未指定";
}

function mapStyleLabel(style: QuickStyle | "") {
  if (style === "cute") return "可爱";
  if (style === "mechanical") return "机械";
  if (style === "realistic") return "写实";
  if (style === "fantasy") return "奇幻";
  return "未指定";
}

function mapStyleToProjectStyle(style: QuickStyle | ""): ProjectFormPayload["style"] {
  if (style === "cute") return "cute";
  if (style === "mechanical") return "industrial";
  if (style === "fantasy") return "fantasy";
  if (style === "realistic") return "minimal";
  return "";
}

function mapDirectionToBuildGoal(direction: QuickDirection | ""): ProjectFormPayload["build_goal"] {
  if (direction === "display") return "brief";
  if (direction === "cost") return "bom";
  if (direction === "production") return "factory";
  return "";
}

function mapPathToCollaborationGoal(path: QuickPath): ProjectFormPayload["collaboration_goal"] {
  if (path === "small_batch") return "factory-bridge";
  if (path === "creator_plan") return "co-create";
  return "review";
}

function hasAnyKeyword(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function resolveQuickScalePreference(input: QuickEntryInput): QuickScalePreference {
  if (input.scale === "small" || input.scale === "medium" || input.scale === "large") {
    return input.scale;
  }

  const text = input.idea.toLowerCase();
  if (hasAnyKeyword(text, ["地标", "文创", "礼品", "纪念", "景区", "泉", "湖"])) return "small";
  if (hasAnyKeyword(text, ["街区", "微景观", "小场景"])) return "medium";
  if (hasAnyKeyword(text, ["完整", "大载具", "巨型", "机甲", "大建筑", "综合体"])) return "large";
  if (input.style === "mechanical") return "medium";
  if (input.direction === "production") return "medium";
  return "small";
}

function inferSuggestedPath(input: QuickEntryInput): QuickPath {
  if (input.scale === "large") return "professional_upgrade";
  if (input.scale === "small") return "small_batch";
  if (input.direction === "display") return "creator_plan";
  if (input.direction === "cost") return "small_batch";
  if (input.direction === "production") return "professional_upgrade";
  if (input.style === "fantasy") return "creator_plan";
  return "professional_upgrade";
}

function firstSentence(text: string, fallback: string) {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const hit = trimmed.match(/^[^。！？!?]+[。！？!?]?/);
  return (hit?.[0] ?? trimmed).trim();
}

function directionJudgementPrefix(direction: QuickDirection | "") {
  if (direction === "display") {
    return "当前更建议先突出视觉锚点与展示氛围，快速验证创意吸引力。";
  }
  if (direction === "cost") {
    return "当前更建议先做结构收敛与复杂度压缩，以低门槛方式试水。";
  }
  if (direction === "production") {
    return "当前更建议先按标准化与可复制路径细化，便于后续专业推进。";
  }
  return "当前更建议先做一轮方向判断，再决定要强化展示还是落地。";
}

function styleJudgementHint(style: QuickStyle | "") {
  if (style === "cute") return "表达语气可偏柔和友好。";
  if (style === "mechanical") return "表达语气可偏结构化与工业感。";
  if (style === "realistic") return "表达语气可偏克制与现实轮廓。";
  if (style === "fantasy") return "表达语气可偏主题感与故事氛围。";
  return "";
}

function buildTopJudgement(input: QuickEntryInput, path: QuickPath) {
  const directionLine = directionJudgementPrefix(input.direction);
  const styleLine = styleJudgementHint(input.style);
  const referenceLine = input.referenceImage.trim() ? "已结合参考图方向做判断。" : "";
  const correctionLine = input.correctionIntent?.trim() ? `本轮按「${input.correctionIntent.trim()}」快速纠偏。` : "";
  const pathLine =
    path === "small_batch"
      ? "建议先做小批量验证。"
      : path === "creator_plan"
        ? "建议先做原创计划 / 众筹方向验证。"
        : "建议补齐约束后升级为专业方案。";

  return [directionLine, styleLine, referenceLine, correctionLine, pathLine].filter(Boolean).join(" ");
}

function buildFitAndReason(path: QuickPath) {
  if (path === "small_batch") {
    return {
      fit: "更适合先做单品小批量测试",
      reason: "当前方向更接近可落地验证，先控制体量与件数会更稳妥。"
    };
  }
  if (path === "creator_plan") {
    return {
      fit: "更适合先做原创计划 / 众筹测试",
      reason: "当前创意更依赖题材表达与用户反馈，先验证传播与兴趣更有效。"
    };
  }
  return {
    fit: "更适合升级为专业方案",
    reason: "当前信息具备继续深化条件，补齐结构与落地约束后更容易推进。"
  };
}

function toReferenceQueryInput(input: QuickEntryInput, path: QuickPath) {
  const styleToken =
    input.style === "cute"
      ? "cute"
      : input.style === "mechanical"
        ? "industrial"
        : input.style === "fantasy"
          ? "fantasy"
          : "minimal";
  const sizeTarget =
    input.scale === "small"
      ? "small"
      : input.scale === "large"
        ? "large"
        : input.direction === "display"
          ? "display"
          : input.direction === "cost"
            ? "small"
            : "medium";
  const recommendation = path === "small_batch" ? "申请打样可行性评估" : path === "creator_plan" ? "提交原创计划评审" : "升级专业方案";

  return {
    category: input.style === "mechanical" ? "mechanism" : "scene",
    style: styleToken,
    sizeTarget,
    audience: "all",
    designBrief: [
      input.idea,
      `偏好方向：${mapDirectionLabel(input.direction)}`,
      `偏好风格：${mapStyleLabel(input.style)}`,
      input.correctionIntent?.trim() ? `纠偏意图：${input.correctionIntent.trim()}` : "",
      input.referenceImage.trim() ? "存在参考图锚点：优先贴近参考风格与场景。" : ""
    ].filter(Boolean),
    bomDraft: [],
    risks: [],
    recommendedNextStep: recommendation,
    generationMode: null
  };
}

export function buildQuickEntryResult(input: QuickEntryInput): QuickEntryResult {
  const suggestedPath = inferSuggestedPath(input);
  const fit = buildFitAndReason(suggestedPath);

  return {
    topJudgement: buildTopJudgement(input, suggestedPath),
    conceptTitle: `${input.idea}（轻量概念版）`,
    conceptPreview: `我们建议先围绕「${mapDirectionLabel(input.direction)}」方向推进，风格可优先采用「${mapStyleLabel(
      input.style
    )}」路径，先做小范围可视化验证，再决定是否进入完整方案。${
      input.correctionIntent?.trim() ? `本轮会重点向「${input.correctionIntent.trim()}」靠拢。` : ""
    }`,
    recommendedFit: fit.fit,
    recommendedReason: fit.reason,
    suggestedPath
  };
}

function mapDirectionToGenerationMode(direction: QuickDirection | ""): GenerationMode | undefined {
  if (direction === "display") return "display_focused";
  if (direction === "cost") return "cost_focused";
  if (direction === "production") return "production_focused";
  return undefined;
}

export function toProjectPayloadFromQuickInput(input: QuickEntryInput): ProjectFormPayload {
  return {
    title: input.idea.slice(0, 20) || "轻量创意",
    category: input.style === "mechanical" ? "mechanism" : "scene",
    style: mapStyleToProjectStyle(input.style),
    size_target:
      input.scale === "small"
        ? "small"
        : input.scale === "medium"
          ? "medium"
          : input.scale === "large"
            ? "large"
            : input.direction === "display"
              ? "display"
              : input.direction === "cost"
                ? "small"
                : "medium",
    size_note: "",
    audience: "all",
    description: input.idea,
    must_have_elements: "",
    avoid_elements: "",
    build_goal: mapDirectionToBuildGoal(input.direction),
    collaboration_goal: "review",
    willing_creator_plan: "",
    willing_sampling: "",
    reference_links: input.referenceImage,
    notes_for_factory: ""
  };
}

export function toGenerationModeFromQuickDirection(direction: QuickDirection | "") {
  return mapDirectionToGenerationMode(direction);
}

export function buildQuickResultFromAIOutput(input: QuickEntryInput, generated: {
  design_summary: string;
  design_positioning: string;
  structure_notes: string;
  recommended_next_step: string;
  production_hint: string;
  recommended_service: string;
}) {
  const inferredFromText: QuickPath = (() => {
    const text = `${generated.recommended_service} ${generated.recommended_next_step}`;
    if (text.includes("原创") || text.includes("众筹")) return "creator_plan";
    if (text.includes("打样") || text.includes("BOM") || text.includes("量产")) return "small_batch";
    return "professional_upgrade";
  })();
  const suggestedPath =
    input.direction === "display"
      ? "creator_plan"
      : input.direction === "cost"
        ? "small_batch"
        : input.direction === "production"
          ? "professional_upgrade"
          : inferredFromText;

  const topJudgement = `${directionJudgementPrefix(input.direction)} ${firstSentence(
    generated.design_summary,
    "这个创意已经形成可继续推进的初步方向。"
  )} ${styleJudgementHint(input.style)}`.trim();
  const conceptPreview = `${firstSentence(generated.design_positioning, "已形成一版可讨论的概念定位。")} ${firstSentence(
    generated.structure_notes,
    "建议先围绕核心表达做首轮验证。"
  )}`.trim();

  return {
    topJudgement,
    conceptTitle: `${input.idea}（AI 轻量概念）`,
    conceptPreview,
    recommendedFit: firstSentence(generated.recommended_next_step, "建议先明确下一步推进路径。"),
    recommendedReason: firstSentence(generated.production_hint, "优先做小范围验证会更稳妥。"),
    suggestedPath
  } satisfies QuickEntryResult;
}

export function pickQuickSimilarReferences(input: QuickEntryInput) {
  const path = inferSuggestedPath(input);
  const base = pickSimilarReferences(toReferenceQueryInput(input, path));
  const directionTypeWeight: Record<QuickDirection, Record<ReferenceType, number>> = {
    display: {
      moc: 4,
      official_set: 1,
      gaozhu_direction: 2
    },
    cost: {
      moc: 1,
      official_set: 2,
      gaozhu_direction: 4
    },
    production: {
      moc: 1,
      official_set: 4,
      gaozhu_direction: 2
    }
  };
  const styleTagWeight: Record<QuickStyle, string[]> = {
    cute: ["家居感", "简洁"],
    mechanical: ["工业", "可动"],
    realistic: ["简洁", "标准件友好"],
    fantasy: ["奇幻", "展示向"]
  };
  const scaleTypeWeight: Record<QuickScalePreference, Record<ReferenceType, number>> = {
    small: { moc: 1, official_set: 2, gaozhu_direction: 4 },
    medium: { moc: 3, official_set: 3, gaozhu_direction: 2 },
    large: { moc: 2, official_set: 4, gaozhu_direction: 2 }
  };
  const correctionText = (input.correctionIntent || "").toLowerCase();
  const correctionKeywords = correctionText
    .split(/[\s,，。.!！？、;；:：\-_/|]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  const styleKey: QuickStyle | null = input.style === "" ? null : input.style;
  const styleTargets = styleKey ? styleTagWeight[styleKey] : [];

  const sorted = [...base].sort((a, b) => {
    const typeA =
      input.direction === ""
        ? 0
        : directionTypeWeight[input.direction][a.referenceType];
    const typeB =
      input.direction === ""
        ? 0
        : directionTypeWeight[input.direction][b.referenceType];
    const styleA = styleTargets.length === 0 ? 0 : a.styleTags.filter((tag) => styleTargets.includes(tag)).length;
    const styleB = styleTargets.length === 0 ? 0 : b.styleTags.filter((tag) => styleTargets.includes(tag)).length;
    const scaleA =
      input.scale === "" ? 0 : scaleTypeWeight[input.scale][a.referenceType];
    const scaleB =
      input.scale === "" ? 0 : scaleTypeWeight[input.scale][b.referenceType];
    const referenceA = input.referenceImage.trim() ? (a.referenceType === "moc" ? 2 : 1) : 0;
    const referenceB = input.referenceImage.trim() ? (b.referenceType === "moc" ? 2 : 1) : 0;
    const textA = `${a.title} ${a.whyRelevant} ${a.takeaway}`.toLowerCase();
    const textB = `${b.title} ${b.whyRelevant} ${b.takeaway}`.toLowerCase();
    const correctionA =
      correctionKeywords.length === 0 ? 0 : correctionKeywords.filter((word) => textA.includes(word)).length * 2;
    const correctionB =
      correctionKeywords.length === 0 ? 0 : correctionKeywords.filter((word) => textB.includes(word)).length * 2;
    return typeB + styleB + scaleB + referenceB + correctionB - (typeA + styleA + scaleA + referenceA + correctionA);
  });

  return sorted.slice(0, 3);
}

export function mapReferenceTypeLabel(type: ReferenceType) {
  if (type === "moc") return "创意参考";
  if (type === "official_set") return "成熟产品参考";
  return "落地参考";
}

export function buildQuickToProfessionalPrefill(input: QuickPrefillPayload): Partial<ProjectFormPayload> {
  const summaryLine = `轻量入口判断：${input.quickJudgement}`;
  const pathLine =
    input.quickPath === "small_batch"
      ? "轻量入口推荐通路：试做成小批量产品"
      : input.quickPath === "creator_plan"
        ? "轻量入口推荐通路：提交到原创计划 / 众筹"
        : "轻量入口推荐通路：升级为专业方案";

  return {
    title: input.idea.slice(0, 20),
    description: input.idea,
    style: mapStyleToProjectStyle(input.style),
    build_goal: mapDirectionToBuildGoal(input.direction),
    collaboration_goal: mapPathToCollaborationGoal(input.quickPath),
    notes_for_factory: [summaryLine, pathLine].join("\n")
  };
}

export function readQuickPrefillFromSession(): QuickPrefillPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(QUICK_PREFILL_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuickPrefillPayload;
    if (!parsed.idea || typeof parsed.idea !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveQuickPrefillToSession(input: QuickPrefillPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(QUICK_PREFILL_SESSION_KEY, JSON.stringify(input));
}

export function saveQuickAIResultToSession(input: {
  input: QuickEntryInput;
  result: QuickEntryResult;
  previewImageUrl?: string | null;
  imageWarning?: string;
}) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    QUICK_AI_RESULT_SESSION_KEY,
    JSON.stringify({
      input: input.input,
      result: input.result,
      previewImageUrl: input.previewImageUrl ?? null,
      imageWarning: input.imageWarning ?? "",
      saved_at: new Date().toISOString()
    })
  );
}

export function updateQuickAIImageInSession(input: {
  idea: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
}) {
  if (typeof window === "undefined") return;
  const raw = window.sessionStorage.getItem(QUICK_AI_RESULT_SESSION_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      input?: QuickEntryInput;
      result?: QuickEntryResult;
      previewImageUrl?: string | null;
      imageWarning?: string;
      saved_at?: string;
    };
    if (!parsed.input || !parsed.result) return;
    if ((parsed.input.idea || "").trim() !== input.idea.trim()) return;

    window.sessionStorage.setItem(
      QUICK_AI_RESULT_SESSION_KEY,
      JSON.stringify({
        ...parsed,
        previewImageUrl: input.previewImageUrl ?? parsed.previewImageUrl ?? null,
        imageWarning: input.imageWarning ?? parsed.imageWarning ?? "",
        saved_at: new Date().toISOString()
      })
    );
  } catch {
    // ignore malformed session cache
  }
}

export function readQuickAIResultFromSession():
  | {
      input: QuickEntryInput;
      result: QuickEntryResult;
      previewImageUrl: string | null;
      imageWarning: string;
      saved_at: string;
    }
  | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(QUICK_AI_RESULT_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      input?: QuickEntryInput;
      result?: QuickEntryResult;
      previewImageUrl?: string | null;
      imageWarning?: string;
      saved_at?: string;
    };
    if (!parsed.input || !parsed.result) return null;
    return {
      input: parsed.input,
      result: parsed.result,
      previewImageUrl: typeof parsed.previewImageUrl === "string" ? parsed.previewImageUrl : null,
      imageWarning: typeof parsed.imageWarning === "string" ? parsed.imageWarning : "",
      saved_at: parsed.saved_at ?? ""
    };
  } catch {
    return null;
  }
}

export function toQuickPrefillFromSearchParams(searchParams: URLSearchParams): QuickPrefillPayload | null {
  const idea = searchParams.get("idea")?.trim() ?? "";
  if (!idea) return null;

  const directionValue = searchParams.get("direction");
  const styleValue = searchParams.get("style");
  const scaleValue = searchParams.get("scale");
  const quickPathValue = searchParams.get("quickPath");
  const quickJudgement = searchParams.get("quickJudgement")?.trim() ?? "";

  const direction: QuickDirection | "" =
    directionValue === "display" || directionValue === "cost" || directionValue === "production"
      ? directionValue
      : "";
  const style: QuickStyle | "" =
    styleValue === "cute" || styleValue === "mechanical" || styleValue === "realistic" || styleValue === "fantasy"
      ? styleValue
      : "";
  const scale: QuickScalePreference | "" =
    scaleValue === "small" || scaleValue === "medium" || scaleValue === "large" ? scaleValue : "";
  const quickPath: QuickPath =
    quickPathValue === "small_batch" || quickPathValue === "creator_plan" || quickPathValue === "professional_upgrade"
      ? quickPathValue
      : "professional_upgrade";

  return {
    idea,
    direction,
    style,
    // scale is used only by quick flow currently; professional prefill keeps minimal mapping.
    // keep parse so quick-link reload stays consistent in quick pages.
    scale,
    quickJudgement,
    quickPath
  };
}

export type { QuickPrefillPayload, ReferenceSample };

