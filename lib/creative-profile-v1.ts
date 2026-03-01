type BomItem = {
  item: string;
  estimate: string;
  note: string;
};

type StrengthLevel = "强" | "中" | "弱";
type CircleLabel = "更偏圈层" | "中间态" | "更可破圈";

export type CreativeProfileItem = {
  key: "theme_identity" | "display_memory" | "productization" | "circle_tendency";
  title: string;
  level: StrengthLevel;
  levelLabel: string;
  summary: string;
};

export type CreativeProfileOverview = {
  overallSummary: string;
  items: CreativeProfileItem[];
};

function includesAny(text: string, words: string[]) {
  const lowered = text.toLowerCase();
  return words.some((word) => lowered.includes(word.toLowerCase()));
}

function asText(input: string[]) {
  return input.join(" ");
}

function toLevel(score: number): StrengthLevel {
  if (score >= 2) return "强";
  if (score <= 0) return "弱";
  return "中";
}

export function buildCreativeProfileOverview(input: {
  category: string;
  style: string;
  sizeTarget: string;
  audience: string;
  designBrief: string[];
  bomDraft: BomItem[];
  risks: string[];
  keyDeductions: string[];
  productionScore: number;
  recommendation: string;
}): CreativeProfileOverview {
  const briefText = asText(input.designBrief);
  const riskText = asText(input.risks);
  const bomText = input.bomDraft.map((item) => `${item.item} ${item.note}`).join(" ");
  const deductionText = asText(input.keyDeductions);

  let themeScore = 0;
  let themeHasData = false;
  if (input.category && input.category !== "未填写") {
    themeScore += 1;
    themeHasData = true;
  }
  if (includesAny(briefText, ["核心", "主题", "轮廓", "一眼", "识别", "主体"])) {
    themeScore += 1;
    themeHasData = true;
  }
  if (includesAny(riskText, ["主体不清晰", "模糊", "看不懂", "解释成本"])) {
    themeScore -= 1;
  }
  const themeLevel = themeHasData ? toLevel(themeScore) : "中";
  const themeSummary =
    themeLevel === "强"
      ? "主体识别清楚，用户通常能快速知道“这是什么”。"
      : themeLevel === "中"
        ? "题材方向基本成立，建议再强化主轮廓与命名一致性。"
        : "题材辨识度偏弱，建议先收敛主体再处理次要表达。";

  let displayScore = 0;
  let displayHasData = false;
  if (includesAny(input.style, ["展示", "复古", "工业", "奇幻"])) {
    displayScore += 1;
    displayHasData = true;
  }
  if (includesAny(briefText, ["视觉重点", "轮廓", "记忆点", "陈列", "展示"])) {
    displayScore += 1;
    displayHasData = true;
  }
  if (includesAny(bomText, ["底座", "外观", "装甲", "立面", "展示"])) {
    displayScore += 1;
    displayHasData = true;
  }
  if (includesAny(riskText, ["远看散", "杂乱", "比例不协调", "摆放语境弱"])) {
    displayScore -= 1;
  }
  const displayLevel = displayHasData ? toLevel(displayScore) : "中";
  const displaySummary =
    displayLevel === "强"
      ? "展示锚点明确，适合放在陈列导向的方案里。"
      : displayLevel === "中"
        ? "已有展示基础，建议压缩次级细节以强化远看记忆点。"
        : "展示记忆点偏弱，建议先保留主视觉再收敛表层装饰。";

  let productScore = 0;
  let productHasData = false;
  if (includesAny(bomText, ["标准", "复用", "模块", "接口", "通用"])) {
    productScore += 1;
    productHasData = true;
  }
  if (!includesAny(deductionText, ["输入信息缺失", "完整度不足"])) {
    productScore += 1;
    productHasData = true;
  }
  if (!includesAny(input.sizeTarget, ["展示级", "1500+"])) {
    productScore += 1;
    productHasData = true;
  }
  if (includesAny(input.recommendation, ["原创计划评审", "打样可行性评估"])) {
    productScore += 1;
    productHasData = true;
  }
  if (includesAny(deductionText, ["非标准化", "特殊件比例偏高", "装饰件占比偏高", "体量"])) {
    productScore -= 1;
  }
  if (includesAny(riskText, ["复杂度高", "失败率偏高", "成本"])) {
    productScore -= 1;
  }
  // 仅做轻量辅助，不让分数直接决定产品化潜力。
  if (input.productionScore >= 80) productScore += 0.5;
  if (input.productionScore < 40) productScore -= 0.5;
  const productLevel = productHasData ? toLevel(productScore) : "中";
  const productSummary =
    productLevel === "强"
      ? "当前具备基础产品化气质，可进入打样或评审前收敛。"
      : productLevel === "中"
        ? "产品化潜力处于中间态，建议先补齐标准化与说明书化信息。"
        : "现阶段更像概念验证方向，建议先收敛结构与标准件策略。";

  let circleScore = 0;
  let circleHasData = false;
  if (includesAny(input.category, ["机", "科幻", "奇幻", "ip", "机械"])) {
    circleScore += 1;
    circleHasData = true;
  }
  if (includesAny(input.style, ["工业", "复古科幻", "机械"])) {
    circleScore += 1;
    circleHasData = true;
  }
  if (includesAny(input.audience, ["亲子", "儿童", "全年龄"])) {
    circleScore -= 1;
    circleHasData = true;
  }
  if (includesAny(input.category, ["城市", "建筑", "载具", "场景"])) {
    circleScore -= 0.5;
    circleHasData = true;
  }
  if (includesAny(riskText, ["过于小众", "圈层"])) {
    circleScore += 1;
  }

  const circleLabel: CircleLabel =
    !circleHasData || Math.abs(circleScore) < 1 ? "中间态" : circleScore >= 1 ? "更偏圈层" : "更可破圈";
  const circleSummary =
    circleLabel === "更偏圈层"
      ? "当前更容易打动题材偏好明确的玩家，破圈空间取决于视觉锚点。"
      : circleLabel === "更可破圈"
        ? "题材理解门槛相对友好，更容易被泛用户快速接受。"
        : "目前处在圈层与泛用户之间的中间态，可按目标受众调整表达重心。";

  const overallSummary = (() => {
    const themePart =
      themeLevel === "强" ? "题材清晰" : themeLevel === "中" ? "题材方向基本清楚" : "题材识别仍需收敛";
    const displayPart =
      displayLevel === "强"
        ? "展示导向明确"
        : displayLevel === "中"
          ? "展示价值处于中间态"
          : "展示锚点还有提升空间";
    const progressPart =
      productLevel === "强"
        ? "适合继续进入打样/评审前收敛"
        : productLevel === "中"
          ? "适合先补关键信息后再推进"
          : "更适合先做概念验证";
    return `这是一个${themePart}、${displayPart}的创意方案，${progressPart}。`;
  })();

  return {
    overallSummary,
    items: [
      {
        key: "theme_identity",
        title: "题材辨识度",
        level: themeLevel,
        levelLabel: themeLevel,
        summary: themeSummary
      },
      {
        key: "display_memory",
        title: "展示记忆点",
        level: displayLevel,
        levelLabel: displayLevel,
        summary: displaySummary
      },
      {
        key: "productization",
        title: "产品化潜力",
        level: productLevel,
        levelLabel: productLevel,
        summary: productSummary
      },
      {
        key: "circle_tendency",
        title: "圈层程度",
        level: "中",
        levelLabel: circleLabel,
        summary: `${circleSummary}（这是受众特征判断，不是好坏判断）`
      }
    ]
  };
}
