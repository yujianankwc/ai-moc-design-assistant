import type { GenerationMode } from "@/types/generation-mode";

type BomItem = {
  item: string;
  estimate: string;
  note: string;
};

export type SuggestionPriority = "高优先" | "中优先" | "可选优化";

export type KeyUpgradeSuggestion = {
  title: string;
  why: string;
  action: string;
  impact: string;
  priority: SuggestionPriority;
};

type BuildInput = {
  productionScore: number;
  keyDeductions: string[];
  bomGroups: BomItem[];
  riskNotes: string[];
  recommendedNextStep: string;
  generationMode?: GenerationMode | null;
};

function includesAny(text: string, words: string[]) {
  const lowered = text.toLowerCase();
  return words.some((word) => lowered.includes(word.toLowerCase()));
}

function addSuggestion(
  target: KeyUpgradeSuggestion[],
  cache: Set<string>,
  key: string,
  value: KeyUpgradeSuggestion
) {
  if (cache.has(key)) return;
  cache.add(key);
  target.push(value);
}

export function buildKeyUpgradeSuggestions(input: BuildInput): KeyUpgradeSuggestion[] {
  const suggestions: KeyUpgradeSuggestion[] = [];
  const dedupeKeys = new Set<string>();
  const deductionsText = input.keyDeductions.join("\n");
  const bomText = input.bomGroups.map((item) => `${item.item} ${item.estimate} ${item.note}`).join("\n");
  const riskText = input.riskNotes.join("\n");

  if (includesAny(deductionsText, ["特殊件比例偏高", "标准化与可获得性不足", "非标准化"])) {
    addSuggestion(suggestions, dedupeKeys, "special-parts", {
      title: "优先收敛非标准件依赖",
      why: "当前方案中非标准件信号较强，会增加采购与装配波动。",
      action: "建议优先把定制件、稀有件替换为可复用标准件，并统一关键连接规格。",
      impact: "这样通常有助于提高打样准备和量产沟通的可控性。",
      priority: "高优先"
    });
  }

  if (includesAny(deductionsText, ["装饰件占比偏高", "装饰件层级过多", "装饰失衡"])) {
    addSuggestion(suggestions, dedupeKeys, "decorative-balance", {
      title: "先做装饰层级压缩",
      why: "当前装饰层级偏重，可能分散结构资源并抬高装配复杂度。",
      action: "更稳妥的做法是先保留主视觉装饰，再减少次级装饰与重复表层件。",
      impact: "可提高首轮打样节奏和零件配比的可控性。",
      priority: "高优先"
    });
  }

  if (
    includesAny(deductionsText, ["结构支撑信息", "结构说明", "结构件占比偏低", "承重和稳定性风险"]) ||
    (includesAny(bomText, ["展示", "外观"]) && !includesAny(bomText, ["结构", "框架", "承重", "连接"]))
  ) {
    addSuggestion(suggestions, dedupeKeys, "structure-path", {
      title: "补齐主结构支撑路径",
      why: "当前结构支撑信息偏弱，难以判断大体量或复杂方案的稳定边界。",
      action: "建议优先补充承重路径、关键连接点和模块间受力关系，再进入下一轮生成。",
      impact: "这样通常有助于降低结构返工概率，并提高评审结论的可信度。",
      priority: "高优先"
    });
  }

  if (includesAny(deductionsText, ["量产目标", "非标准化", "装配复杂度仍偏高"])) {
    addSuggestion(suggestions, dedupeKeys, "production-standardize", {
      title: "先统一模块接口与连接方式",
      why: "当前方案在量产目标下仍存在非标准化信号。",
      action: "建议优先收敛连接件类型、接口尺寸和模块拆分规则，再评估打样节奏。",
      impact: "可提高跨团队沟通与后续装配执行的一致性。",
      priority: "中优先"
    });
  }

  if (includesAny(deductionsText, ["输入信息缺失较多", "方案完整度不足"])) {
    addSuggestion(suggestions, dedupeKeys, "complete-input", {
      title: "先补关键约束再重新生成",
      why: "当前输入信息不足会削弱方案判断的稳定性。",
      action: "建议优先补充目标体量、必须元素和工厂备注等关键约束后再重新生成。",
      impact: "这样通常有助于减少方向性偏差，提升建议结果的可执行性。",
      priority: "高优先"
    });
  }

  if (includesAny(riskText, ["高风险", "不稳定", "拼接", "返工", "失败率", "冲突", "承重"])) {
    addSuggestion(suggestions, dedupeKeys, "risk-modularize", {
      title: "将高风险结构拆分为小模块验证",
      why: "风险提示中已有结构或拼接类高风险信号。",
      action: "建议优先把复杂结构拆成更小模块，先验证连接稳定性，再回拼整体验证。",
      impact: "可提高首轮打样问题定位效率，降低整体返工范围。",
      priority: "中优先"
    });
  }

  if (suggestions.length < 2) {
    const fallbackTitle =
      input.productionScore < 40
        ? "先做信息补齐与结构收敛"
        : input.recommendedNextStep.includes("打样")
          ? "围绕打样目标先收敛关键模块"
          : "先聚焦一条主改造路径";

    addSuggestion(suggestions, dedupeKeys, "fallback-info", {
      title: fallbackTitle,
      why: "当前信息更适合做方向判断，暂不适合做过细结论。",
      action: "建议优先补充结构支撑描述与关键约束，再进行下一轮对比生成。",
      impact: "这样通常有助于让后续建议更稳定，并提高方案推进的可控性。",
      priority: "中优先"
    });
  }

  if (input.generationMode === "display_focused" && suggestions.length < 3) {
    addSuggestion(suggestions, dedupeKeys, "display-mode-balance", {
      title: "保持展示亮点同时预留结构冗余",
      why: "当前为偏展示模式，容易出现外观优先而结构信息不足的情况。",
      action: "更稳妥的做法是在主视觉不变的前提下，补一版简化结构方案作为对照。",
      impact: "可提高展示方案向打样方案迁移时的可控性。",
      priority: "可选优化"
    });
  }

  return suggestions.slice(0, 3);
}
