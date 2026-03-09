import type { ShowcaseJudgement, ShowcaseNextSuggestion, ShowcaseStage } from "@/data/showcase-projects";
import type { QuickEntryInput, QuickPath } from "@/types/quick-entry";

export type ProjectPathLabel = "试做路径" | "完整方案路径" | "公开展示路径";

export const PROJECT_STAGE_LABELS: ShowcaseStage[] = [
  "创意已生成",
  "方向判断完成",
  "已提交意向",
  "公开展示中"
];

export function inferJudgementFromQuickInput(input: QuickEntryInput): ShowcaseJudgement {
  const text = input.idea;
  if (/(景区|文创|地标|礼盒|纪念)/.test(text)) return "更适合作为文创单品尝试";
  if (/(礼物|送礼|纪念)/.test(text)) return "更适合礼物方向";
  if (/(场景|厨房|桌面|微景观|家庭)/.test(text)) return "更适合桌面陈列 / 小场景方向";
  if (/(奇幻|世界观|故事|漂浮岛)/.test(text)) return "更适合扩展故事感";
  if (/(系列|系列化)/.test(text)) return "更适合做系列化";
  if (/(收藏|文物|博物馆)/.test(text)) return "更适合面向收藏用户";
  if (/(机械|载具|巡逻|战舰|结构)/.test(text)) return "更适合先验证用户兴趣";
  return "更适合先做小批量验证";
}

export function inferFitForFromJudgement(judgement: ShowcaseJudgement) {
  const map: Record<ShowcaseJudgement, string> = {
    "更适合先做小批量验证": "更适合先做一版可验证的试水方案。",
    "更适合礼物方向": "更适合作为礼物或纪念款方向继续推进。",
    "更适合做系列化": "更适合继续扩成系列主题，而不是只做单款。",
    "更适合扩展故事感": "更适合先补强故事和场景表达，再决定是否继续。",
    "更适合面向收藏用户": "更适合面向收藏型用户和纪念向场景。",
    "更适合先验证用户兴趣": "更适合先看用户会不会对这个题材买单。",
    "更适合桌面陈列 / 小场景方向": "更适合作为桌面摆件或小场景方向继续。",
    "更适合作为文创单品尝试": "更适合作为文创单品先做一轮方向验证。"
  };
  return map[judgement];
}

export function inferNextSuggestionFromJudgement(judgement: ShowcaseJudgement): ShowcaseNextSuggestion {
  if (judgement === "更适合扩展故事感") return "生成完整方案";
  if (judgement === "更适合做系列化") return "生成完整方案";
  if (judgement === "更适合先验证用户兴趣") return "查看相似灵感";
  if (judgement === "更适合桌面陈列 / 小场景方向") return "继续公开展示";
  return "去看试做路径";
}

export function formatNextSuggestionLabel(suggestion: ShowcaseNextSuggestion) {
  if (suggestion === "生成完整方案") return "先把这个方向补充完整";
  return suggestion;
}

export function mapQuickPathToLabel(path: QuickPath): ProjectPathLabel {
  if (path === "small_batch") return "试做路径";
  if (path === "professional_upgrade") return "完整方案路径";
  return "公开展示路径";
}

export function mapIntentStatusToUnifiedStage(status: string): ShowcaseStage {
  if (status === "quoted" || status === "deposit_pending" || status === "locked" || status === "closed_won") {
    return "已提交意向";
  }
  return "方向判断完成";
}

export function mapIntentSourceTypeToPathLabel(sourceType: string): ProjectPathLabel {
  if (sourceType === "small_batch") return "试做路径";
  if (sourceType === "professional_upgrade") return "完整方案路径";
  return "公开展示路径";
}

export function mapIntentSourceTypeToJudgement(sourceType: string): ShowcaseJudgement {
  if (sourceType === "small_batch") return "更适合先做小批量验证";
  if (sourceType === "professional_upgrade") return "更适合扩展故事感";
  return "更适合先验证用户兴趣";
}

export function mapProjectStatusToUnifiedStage(status: string | null | undefined): ShowcaseStage {
  if (status === "completed") return "已提交意向";
  if (status === "generating") return "方向判断完成";
  return "创意已生成";
}

export function mapProjectCategoryToPathLabel(category: string | null | undefined): ProjectPathLabel {
  if (category === "quick_entry") return "试做路径";
  return "完整方案路径";
}

export function inferJudgementFromProjectSnapshot(input: {
  category?: string | null;
  style?: string | null;
  audience?: string | null;
  designBrief?: string[];
  recommendation?: string | null;
}): ShowcaseJudgement {
  const haystack = [
    input.category ?? "",
    input.style ?? "",
    input.audience ?? "",
    input.recommendation ?? "",
    ...(input.designBrief ?? [])
  ].join(" ");

  if (/(architecture|文博|博物|收藏|adult)/i.test(haystack)) return "更适合面向收藏用户";
  if (/(scene|家庭|桌面|微景观|display)/i.test(haystack)) return "更适合桌面陈列 / 小场景方向";
  if (/(character|礼物|送礼|campus)/i.test(haystack)) return "更适合礼物方向";
  if (/(vehicle|mechanism|机械|载具)/i.test(haystack)) return "更适合先验证用户兴趣";
  if (/(原创计划评审|系列|series)/i.test(haystack)) return "更适合做系列化";
  if (/(fantasy|故事|世界观|冒险)/i.test(haystack)) return "更适合扩展故事感";
  if (/(文创|景区|纪念|礼盒)/i.test(haystack)) return "更适合作为文创单品尝试";
  return "更适合先做小批量验证";
}

export function getStageExplanation(stage: ShowcaseStage, pathLabel: ProjectPathLabel) {
  if (stage === "创意已生成") {
    return `当前处于创意已生成阶段，说明这条方向已经被记下来，下一步更适合沿着${pathLabel}继续补充判断。`;
  }
  if (stage === "方向判断完成") {
    return `当前处于方向判断完成阶段，说明这个方向已经看清楚了，现在更适合决定是否进入${pathLabel}继续推进。`;
  }
  if (stage === "已提交意向") {
    return "当前已提交意向，说明这个方向已经进入进一步推进和沟通阶段。";
  }
  return "当前处于公开展示中，适合先让更多人看到这个方向，再判断是否继续推进。";
}
