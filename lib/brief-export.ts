type BomItem = {
  item: string;
  estimate: string;
  note: string;
};

export type ProjectBriefExportData = {
  projectName: string;
  projectId: string;
  statusLabel: string;
  categoryLabel: string;
  styleLabel: string;
  sizeTargetLabel: string;
  audienceLabel: string;
  designBrief: string[];
  bomDraft: BomItem[];
  risks: string[];
  productionScore: number;
  buildDifficultyLabel: string;
  recommendation: string;
  manufacturabilityTips: string[];
  collaborationAdvice: string[];
  manualEditContent: string;
  updatedAtText: string;
  isFallbackResult: boolean;
};

function dedupe(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitNumberedTextToLines(text: string) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/(\d+[\.\)]\s*)/g, "\n$1")
    .replace(/([（(]\d+[）)]\s*)/g, "\n$1")
    .replace(/\n+/g, "\n")
    .trim();

  if (!normalized) return [];

  return normalized
    .split("\n")
    .map((line) =>
      line
        .replace(/^\d+[\.\)]\s*/, "")
        .replace(/^[（(]\d+[）)]\s*/, "")
        .trim()
    )
    .filter(Boolean);
}

function toBulletList(items: string[]) {
  if (!items.length) return "- 暂无";
  return items.map((item) => `- ${item}`).join("\n");
}

function normalizeBomItems(items: BomItem[]) {
  const percentageRegex = /(\d+(?:\.\d+)?)\s*%/g;
  let totalPercent = 0;
  let hasPercent = false;

  for (const item of items) {
    for (const source of [item.estimate, item.note]) {
      let match: RegExpExecArray | null = percentageRegex.exec(source);
      while (match) {
        hasPercent = true;
        totalPercent += Number(match[1]);
        match = percentageRegex.exec(source);
      }
      percentageRegex.lastIndex = 0;
    }
  }

  const shouldDowngradePercent = hasPercent && (totalPercent < 98 || totalPercent > 102);

  return items.map((item) => {
    if (!shouldDowngradePercent) return item;
    return {
      ...item,
      estimate: item.estimate.includes("%")
        ? "大致比例（以实际清单为准）"
        : item.estimate,
      note: item.note.includes("%")
        ? item.note.replace(/(\d+(?:\.\d+)?)\s*%/g, "大致比例")
        : item.note
    };
  });
}

function toBomList(items: BomItem[]) {
  if (!items.length) return "- 暂无";
  const normalizedItems = normalizeBomItems(items);

  return normalizedItems
    .map(
      (item) =>
        `- ${item.item}\n  - 预估数量：${item.estimate}\n  - 说明：${item.note || "暂无补充"}`
    )
    .join("\n");
}

function buildDesignBriefSection(items: string[]) {
  const cleaned = dedupe(items.map((item) => item.trim()).filter(Boolean));
  if (!cleaned.length) {
    return "暂无设计简报内容。";
  }

  const summary = cleaned[0];
  const highlights = cleaned.slice(1, 6);
  const safeHighlights = highlights.length ? highlights : cleaned.slice(0, 5);

  return `### 总述
${summary}

### 关键亮点
${toBulletList(safeHighlights)}`;
}

function buildRiskSection(items: string[]) {
  const normalized = dedupe(
    items.flatMap((item) => splitNumberedTextToLines(item)).map((line) => line.trim())
  );
  return toBulletList(normalized);
}

function buildCollaborationSection(items: string[]) {
  const normalized = dedupe(
    items.flatMap((item) => splitNumberedTextToLines(item)).map((line) => line.trim())
  );

  const first = normalized[0] || "先确认本轮方案的关键目标和边界。";
  const second = normalized[1] || "先做该步骤可以降低后续返工和沟通成本。";
  const third = normalized[2] || "完成后进入下一步评审或打样评估。";

  return `- 当前建议先做：${first}
- 为什么先做：${second}
- 完成后进入：${third}`;
}

function shouldExportManualEditContent(content: string) {
  const text = content.trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  if (lowered.includes("v0.1")) return false;
  if (text.includes("未编辑") || text.includes("默认")) return false;
  if (text.startsWith("建议补充：")) return false;
  return true;
}

export function buildProjectBriefMarkdown(data: ProjectBriefExportData) {
  const fallbackNote = data.isFallbackResult
    ? "> 当前内容为系统回退结果，建议后续重新生成复核。\n"
    : "";

  const manualEditSection = shouldExportManualEditContent(data.manualEditContent)
    ? `## 人工编辑区当前内容
${data.manualEditContent}
`
    : "";

  return `# 项目简报：${data.projectName}

${fallbackNote}
## 项目基础信息
- 项目名称：${data.projectName}
- 项目 ID：${data.projectId}
- 项目状态：${data.statusLabel}
- 作品类型：${data.categoryLabel}
- 风格方向：${data.styleLabel}
- 目标体量：${data.sizeTargetLabel}
- 目标受众：${data.audienceLabel}
- 更新时间：${data.updatedAtText}

## AI 设计简报
${buildDesignBriefSection(data.designBrief)}

## 零件规划草案
用于前期评审与打样前规划，不作为最终生产清单。

${toBomList(data.bomDraft)}

## 风险提示
${buildRiskSection(data.risks)}

## 可生产性建议
- 可生产性评分：${data.productionScore} / 100
- 搭建复杂度：${data.buildDifficultyLabel}
- 主推荐动作：${data.recommendation}

${toBulletList(data.manufacturabilityTips)}

## 下一步合作建议
${buildCollaborationSection(data.collaborationAdvice)}

${manualEditSection}
`;
}
