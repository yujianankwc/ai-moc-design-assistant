import type { GenerationMode } from "@/types/generation-mode";
import {
  referenceSamples,
  type ReferenceSample,
  type ReferenceType
} from "@/lib/reference-samples";

type BomItem = {
  item: string;
  estimate: string;
  note: string;
};

type MatchInput = {
  category: string;
  style: string;
  sizeTarget: string;
  audience: string;
  designBrief: string[];
  bomDraft: BomItem[];
  risks: string[];
  recommendedNextStep: string;
  generationMode?: GenerationMode | null;
};

function normalizeCategory(value: string) {
  const v = value.toLowerCase();
  if (v.includes("mechanism") || v.includes("机")) return ["机甲", "科幻"];
  if (v.includes("vehicle") || v.includes("载具")) return ["载具", "城市"];
  if (v.includes("scene") || v.includes("场景")) return ["城市", "建筑"];
  if (v.includes("architecture") || v.includes("建筑")) return ["建筑"];
  if (v.includes("character") || v.includes("人仔") || v.includes("角色")) return ["城市", "奇幻"];
  return ["城市"];
}

function normalizeStyle(value: string) {
  const v = value.toLowerCase();
  const tags: string[] = [];
  if (v.includes("industrial") || v.includes("工业")) tags.push("工业");
  if (v.includes("retro") || v.includes("复古")) tags.push("复古");
  if (v.includes("fantasy") || v.includes("奇幻")) tags.push("奇幻");
  if (v.includes("minimal") || v.includes("极简")) tags.push("简洁");
  if (v.includes("cute") || v.includes("可爱")) tags.push("家居感");
  if (!tags.length) tags.push("展示向");
  return tags;
}

function normalizeSize(value: string) {
  const v = value.toLowerCase();
  if (v.includes("display") || v.includes("展示")) return ["展示级"];
  if (v.includes("large") || v.includes("大型")) return ["大"];
  if (v.includes("medium") || v.includes("中型")) return ["中"];
  if (v.includes("small") || v.includes("小型")) return ["小"];
  return ["中"];
}

function normalizeAudience(value: string) {
  const v = value.toLowerCase();
  if (v.includes("kids") || v.includes("儿童")) return ["儿童"];
  if (v.includes("teen") || v.includes("青少年")) return ["青少年"];
  if (v.includes("family") || v.includes("亲子")) return ["亲子"];
  if (v.includes("adult") || v.includes("成人")) return ["成人收藏"];
  return ["青少年"];
}

function inferFeatureTags(input: MatchInput) {
  const text = `${input.designBrief.join(" ")} ${input.bomDraft
    .map((item) => `${item.item} ${item.note}`)
    .join(" ")} ${input.risks.join(" ")} ${input.recommendedNextStep}`.toLowerCase();

  const features: string[] = [];
  if (text.includes("模块") || text.includes("module")) features.push("模块化");
  if (text.includes("可动") || text.includes("关节")) features.push("可动");
  if (text.includes("标准")) features.push("标准件友好");
  if (text.includes("场景")) features.push("场景化");
  if (text.includes("发光") || text.includes("灯")) features.push("发光");
  if (text.includes("定制") || text.includes("稀有") || text.includes("异形")) {
    features.push("定制件较多");
  }
  if (!features.length) features.push("标准件友好");
  return features;
}

function overlapCount(a: string[], b: string[]) {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item)).length;
}

function scoreSample(sample: ReferenceSample, query: {
  themeTags: string[];
  styleTags: string[];
  sizeTags: string[];
  audienceTags: string[];
  featureTags: string[];
}) {
  let score = 0;
  score += overlapCount(sample.themeTags, query.themeTags) * 5;
  score += overlapCount(sample.styleTags, query.styleTags) * 4;
  score += overlapCount(sample.sizeTags, query.sizeTags) * 3;
  score += overlapCount(sample.audienceTags, query.audienceTags) * 3;
  score += overlapCount(sample.featureTags, query.featureTags) * 3;

  if (sample.referenceType === "gaozhu_direction") {
    score += 1; // 轻量落地参考加权
  }
  return score;
}

function hasType(items: Array<{ sample: ReferenceSample; score: number }>, type: ReferenceType) {
  return items.some((item) => item.sample.referenceType === type);
}

function isOfficialSetClearlyConflicting(
  sample: ReferenceSample,
  query: {
    themeTags: string[];
    sizeTags: string[];
    audienceTags: string[];
  }
) {
  const themeOverlap = overlapCount(sample.themeTags, query.themeTags);
  const sizeOverlap = overlapCount(sample.sizeTags, query.sizeTags);
  const audienceOverlap = overlapCount(sample.audienceTags, query.audienceTags);

  const themeConflict = themeOverlap === 0;
  const sizeConflict =
    sizeOverlap === 0 &&
    ((query.sizeTags.includes("展示级") && sample.sizeTags.includes("小")) ||
      (query.sizeTags.includes("大") && sample.sizeTags.includes("小")));
  const audienceConflict =
    audienceOverlap === 0 &&
    query.audienceTags.includes("成人收藏") &&
    sample.audienceTags.includes("儿童") &&
    !sample.audienceTags.includes("青少年");

  return themeConflict || sizeConflict || audienceConflict;
}

function pickBestCandidateByType(
  ranked: Array<{ sample: ReferenceSample; score: number }>,
  targetType: ReferenceType,
  usedIds: Set<string>,
  query?: {
    themeTags: string[];
    sizeTags: string[];
    audienceTags: string[];
  }
) {
  const typeCandidates = ranked.filter(
    (item) => item.sample.referenceType === targetType && !usedIds.has(item.sample.id)
  );
  if (!typeCandidates.length) return null;

  if (targetType === "official_set" && query) {
    const nonConflicting = typeCandidates.filter(
      (item) => !isOfficialSetClearlyConflicting(item.sample, query)
    );
    if (nonConflicting.length > 0) {
      return { item: nonConflicting[0], usedFallbackAnchor: false };
    }
  } else {
    const reasonable = typeCandidates.find((item) => item.score >= 6);
    if (reasonable) return { item: reasonable, usedFallbackAnchor: false };
  }

  // 命中不足时使用通用保底候选，避免硬塞明显不相关项。
  const fallbackByType: Record<ReferenceType, string> = {
    moc: "ref-moc-001",
    official_set: "ref-off-001",
    gaozhu_direction: "ref-gz-001"
  };
  const fallback = typeCandidates.find((item) => item.sample.id === fallbackByType[targetType]);
  return fallback ? { item: fallback, usedFallbackAnchor: true } : null;
}

function ensureTypeVisibleInTop(
  top: Array<{ sample: ReferenceSample; score: number }>,
  selected: Array<{ sample: ReferenceSample; score: number }>,
  requiredType: ReferenceType
) {
  if (top.some((item) => item.sample.referenceType === requiredType)) return;
  const candidate = selected.find((item) => item.sample.referenceType === requiredType);
  if (!candidate) return;

  const replaceIndex = [...top]
    .reverse()
    .findIndex((item) => item.sample.referenceType !== "official_set" && item.sample.referenceType !== "gaozhu_direction");
  const actualIndex = replaceIndex === -1 ? top.length - 1 : top.length - 1 - replaceIndex;
  top[actualIndex] = candidate;
}

export function pickSimilarReferences(input: MatchInput) {
  const query = {
    themeTags: normalizeCategory(input.category),
    styleTags: normalizeStyle(input.style),
    sizeTags: normalizeSize(input.sizeTarget),
    audienceTags: normalizeAudience(input.audience),
    featureTags: inferFeatureTags(input)
  };

  const ranked = referenceSamples
    .map((sample) => ({
      sample,
      score: scoreSample(sample, query)
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.filter((item) => item.score > 0).slice(0, 5);
  const usedIds = new Set(selected.map((item) => item.sample.id));
  const forcedOfficialIds = new Set<string>();

  // 轻量类型平衡补位：尽量包含官方套装与高砖方向。
  if (!hasType(selected, "official_set")) {
    const officialCandidate = pickBestCandidateByType(ranked, "official_set", usedIds, {
      themeTags: query.themeTags,
      sizeTags: query.sizeTags,
      audienceTags: query.audienceTags
    });
    if (officialCandidate) {
      selected.push(officialCandidate.item);
      usedIds.add(officialCandidate.item.sample.id);
      if (officialCandidate.usedFallbackAnchor) {
        forcedOfficialIds.add(officialCandidate.item.sample.id);
      }
    }
  }
  if (!hasType(selected, "gaozhu_direction")) {
    const gaozhuCandidate = pickBestCandidateByType(ranked, "gaozhu_direction", usedIds);
    if (gaozhuCandidate) {
      selected.push(gaozhuCandidate.item);
      usedIds.add(gaozhuCandidate.item.sample.id);
    }
  }

  // 补位后按原始分数回排，避免“硬拼”视觉感。
  selected.sort((a, b) => b.score - a.score);

  const topEntries = selected.slice(0, 5);
  // 以“结果可见”为准，确保最终展示中包含官方套装与高砖方向（若存在合理候选）。
  ensureTypeVisibleInTop(topEntries, selected, "official_set");
  ensureTypeVisibleInTop(topEntries, selected, "gaozhu_direction");

  const top = topEntries.map((item) => {
    if (
      item.sample.referenceType !== "official_set" ||
      (item.score >= 6 && !forcedOfficialIds.has(item.sample.id))
    ) {
      return item.sample;
    }
    return {
      ...item.sample,
      whyRelevant: "可作为成熟产品逻辑参考。",
      takeaway: "适合参考其体量控制、结构组织与受众定位。"
    };
  });
  if (top.length >= 3) return top;

  for (const fallback of ranked.map((item) => item.sample)) {
    if (usedIds.has(fallback.id)) continue;
    top.push(fallback);
    usedIds.add(fallback.id);
    if (top.length >= 3) break;
  }
  return top;
}
