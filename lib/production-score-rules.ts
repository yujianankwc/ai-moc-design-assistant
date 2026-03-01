import type { GenerationMode } from "@/types/generation-mode";
import type { ProjectFormPayload } from "@/types/project";

type BomGroupInput = {
  item: string;
  estimate: string;
  note: string;
};

export type ScoreBreakdown = {
  structureFeasibility: number;
  standardization: number;
  costControl: number;
  assemblyComplexity: number;
  completeness: number;
  creativityValue: number;
};

export type RuleScoreResult = {
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  keyDeductions: string[];
  recommendedNextStep: string;
  recommendedService: string;
};

const SCORE_MAX: ScoreBreakdown = {
  structureFeasibility: 30,
  standardization: 20,
  costControl: 20,
  assemblyComplexity: 15,
  completeness: 10,
  creativityValue: 5
};

function parsePercent(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1]);
}

function parseAllPercents(value: string) {
  const matches = value.match(/(\d+(?:\.\d+)?)\s*%/g);
  if (!matches) return [];
  return matches
    .map((item) => parsePercent(item))
    .filter((item): item is number => item !== null);
}

function includesAny(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}

function toRiskList(riskNotes: string) {
  return riskNotes
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

type BomCategory = "structure" | "decorative" | "special" | "other";

const structureKeywords = [
  "结构",
  "框架",
  "连接",
  "承重",
  "骨架",
  "底盘",
  "支撑",
  "joint",
  "frame",
  "technic"
];
const decorativeKeywords = [
  "装饰",
  "外观",
  "贴片",
  "面板",
  "壳",
  "饰件",
  "展示",
  "deco",
  "skin"
];
const specialKeywords = [
  "特殊",
  "稀有",
  "透明",
  "印刷",
  "异形",
  "定制",
  "限量",
  "special",
  "rare"
];

function classifyBomCategory(item: BomGroupInput): BomCategory {
  const text = `${item.item} ${item.estimate} ${item.note}`;
  if (includesAny(text, structureKeywords)) return "structure";
  if (includesAny(text, specialKeywords)) return "special";
  if (includesAny(text, decorativeKeywords)) return "decorative";
  return "other";
}

function countByCategory(categories: BomCategory[], target: BomCategory) {
  return categories.filter((item) => item === target).length;
}

export function getRecommendedServiceByRuleScore(score: number) {
  if (score >= 80) return "提交原创计划评审";
  if (score >= 60) return "申请打样可行性评估";
  if (score >= 40) return "申请 BOM 快速校对";
  return "先补充方案信息 / 先收敛结构";
}

export function evaluateProductionScoreByRules(input: {
  payload: ProjectFormPayload;
  bomGroups: BomGroupInput[];
  riskNotes: string;
  mode?: GenerationMode;
}): RuleScoreResult {
  const breakdown: ScoreBreakdown = { ...SCORE_MAX };
  const deductionReasons: string[] = [];

  const addDeduction = (key: keyof ScoreBreakdown, points: number, reason: string) => {
    if (points <= 0) return;
    const applied = Math.min(points, breakdown[key]);
    if (applied <= 0) return;
    breakdown[key] -= applied;
    deductionReasons.push(reason);
  };

  const sizeTarget = input.payload.size_target;
  const isLargeScale = sizeTarget === "large" || sizeTarget === "display";
  const bomText = input.bomGroups.map((item) => `${item.item} ${item.estimate} ${item.note}`).join(" ");
  const categories = input.bomGroups.map((item) => classifyBomCategory(item));
  const structureGroupCount = countByCategory(categories, "structure");
  const decorativeGroupCount = countByCategory(categories, "decorative");
  const specialGroupCount = countByCategory(categories, "special");
  const topGroupCategories = categories.slice(0, 3);
  const topDecorativeCount = topGroupCategories.filter((item) => item === "decorative").length;
  const topStructureCount = topGroupCategories.filter((item) => item === "structure").length;

  const structurePercentValues = input.bomGroups
    .filter((item) => includesAny(`${item.item} ${item.note}`, structureKeywords))
    .flatMap((item) => parseAllPercents(`${item.estimate} ${item.note}`));
  const structurePercent = structurePercentValues.reduce((sum, value) => sum + value, 0);
  const hasStructurePercent = structurePercentValues.length > 0;

  if (isLargeScale && hasStructurePercent && structurePercent < 28) {
    addDeduction("structureFeasibility", 9, "大体量方案中结构件占比偏低，承重和稳定性风险较高。");
  }
  if (isLargeScale && !hasStructurePercent && structureGroupCount <= 1 && decorativeGroupCount >= structureGroupCount + 1) {
    addDeduction(
      "structureFeasibility",
      5,
      "当前未形成足够明确的结构支撑信息，大体量方案建议补充结构说明后再评估。"
    );
  }

  const specialPartPercentValues = input.bomGroups
    .filter((item) => includesAny(`${item.item} ${item.note}`, specialKeywords))
    .flatMap((item) => parseAllPercents(`${item.estimate} ${item.note}`));
  const specialPartPercent = specialPartPercentValues.reduce((sum, value) => sum + value, 0);
  const hasSpecialPercent = specialPartPercentValues.length > 0;

  const specialSignalStrong =
    (hasSpecialPercent && specialPartPercent >= 25) ||
    specialGroupCount >= 2 ||
    includesAny(bomText, ["特殊件比例偏高", "稀有件较多", "定制件较多"]);
  if (specialSignalStrong) {
    addDeduction("standardization", 8, "特殊件比例偏高，标准化与可获得性不足。");
    addDeduction("costControl", 6, "特殊件较多会抬高采购与打样成本。");
  }

  const decorativePercentValues = input.bomGroups
    .filter((item) => includesAny(`${item.item} ${item.note}`, decorativeKeywords))
    .flatMap((item) => parseAllPercents(`${item.estimate} ${item.note}`));
  const decorativePercent = decorativePercentValues.reduce((sum, value) => sum + value, 0);
  const hasDecorativePercent = decorativePercentValues.length > 0;

  const decorativeDominated =
    (hasDecorativePercent && decorativePercent >= 45) ||
    (topDecorativeCount >= 2 && topStructureCount === 0) ||
    (decorativeGroupCount >= structureGroupCount + 2 && decorativeGroupCount >= 2);
  if (decorativeDominated) {
    addDeduction("costControl", 6, "装饰件占比偏高，成本与组装效率不够均衡。");
    addDeduction("assemblyComplexity", 4, "装饰件层级过多，装配复杂度上升。");
  }

  const missingCount = [
    input.payload.description,
    input.payload.must_have_elements,
    input.payload.build_goal,
    input.payload.notes_for_factory
  ].filter((value) => !value?.trim()).length;

  if (missingCount >= 2) {
    addDeduction("completeness", 6, "输入信息缺失较多，方案完整度不足。");
  }

  const productionIntent = includesAny(
    `${input.payload.collaboration_goal} ${input.payload.notes_for_factory} ${input.payload.build_goal}`,
    ["factory", "量产", "打样", "生产", "规模化", "标准化"]
  );
  const nonStandardSignals =
    (hasSpecialPercent && specialPartPercent >= 20) ||
    specialGroupCount >= 2 ||
    includesAny(bomText, ["定制", "异形", "手工", "复杂拼接", "多色分件"]);

  if ((productionIntent || input.mode === "production_focused") && nonStandardSignals) {
    addDeduction("standardization", 6, "目标偏量产，但当前方案仍偏非标准化。");
    addDeduction("assemblyComplexity", 4, "量产目标下装配复杂度仍偏高，需进一步收敛。");
  }

  const riskItems = toRiskList(input.riskNotes);
  const highRiskCount = riskItems.filter((item) =>
    includesAny(item, ["高风险", "不稳定", "失败率", "冲突", "偏高", "返工", "难度高"])
  ).length;
  if (highRiskCount >= 2) {
    addDeduction("structureFeasibility", 4, "风险项中存在多条高风险描述，结构可行性需复核。");
    addDeduction("assemblyComplexity", 3, "高风险项较多，量产装配稳定性不足。");
  }

  const baseScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        breakdown.structureFeasibility +
          breakdown.standardization +
          breakdown.costControl +
          breakdown.assemblyComplexity +
          breakdown.completeness +
          breakdown.creativityValue
      )
    )
  );
  // 方式 B：展示模式给一个极小偏置，避免“偏展示版”完全无体现。
  // 偏置很小且仍受总分 100 限制，不会造成夸张拉分。
  const displayModeBias = input.mode === "display_focused" ? 2 : 0;
  const finalScore = Math.min(100, baseScore + displayModeBias);

  const recommended = getRecommendedServiceByRuleScore(finalScore);
  const keyDeductions =
    deductionReasons.length > 0
      ? deductionReasons.slice(0, 4)
      : ["当前方案整体较均衡，未触发明显扣分项。"];

  return {
    finalScore,
    scoreBreakdown: breakdown,
    keyDeductions,
    recommendedNextStep: recommended,
    recommendedService: recommended
  };
}
