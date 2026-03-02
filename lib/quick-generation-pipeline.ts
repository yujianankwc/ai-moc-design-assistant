import { pickSimilarReferences } from "@/lib/reference-matcher";
import { matchScenicSpotByIdea } from "@/lib/scenic-knowledge";
import type { ReferenceType } from "@/lib/reference-samples";
import type {
  QuickDirection,
  QuickEntryInput,
  QuickEntryResult,
  QuickPath,
  QuickScalePreference,
  QuickStyle
} from "@/types/quick-entry";

type QuickSubjectType =
  | "vehicle"
  | "industrial_device"
  | "mecha"
  | "scene"
  | "architecture"
  | "character"
  | "unknown";
type QuickIntentType = "display" | "gift" | "single_product" | "series" | "exploration";
type QuickAudienceGuess = "kids" | "teen" | "family" | "adult" | "all";

export type QuickGenerationSummary = {
  rawIdea: string;
  subjectType: QuickSubjectType;
  intentType: QuickIntentType;
  directionBias: QuickDirection | "";
  styleBias: QuickStyle | "";
  scaleBias: QuickScalePreference | "";
  effectiveScale: QuickScalePreference;
  audienceGuess: QuickAudienceGuess;
  primaryGoal: QuickPath;
  isShortInput: boolean;
  completedTheme: string;
  completedIntent: string;
  defaultScenario: string;
  hasReferenceAnchor: boolean;
  referenceAnchorNote: string;
  correctionIntent: string;
  scenicSpotName: string;
  scenicHighlights: string[];
  antiDriftRules: string[];
};

export type QuickKnowledgeAnchor = {
  id: string;
  title: string;
  referenceType: ReferenceType;
  whyRelevant: string;
  takeaway: string;
};

export type QuickKnowledgePack = {
  themeTags: string[];
  valueTags: string[];
  riskTags: string[];
  anchors: QuickKnowledgeAnchor[];
};

export type QuickCopyDraft = {
  topJudgement: string;
  conceptPreview: string;
  recommendedReason: string;
};

export type QuickImageMode = "concept_preview" | "product_showcase_with_packaging";

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function trimToChars(text: string, maxChars: number) {
  const chars = Array.from(text.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars).join("")}…`;
}

function normalizeIdea(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function isShortIdeaInput(idea: string) {
  const compact = idea.replace(/\s+/g, "");
  if (compact.length < 8) return true;
  const tokens = idea
    .trim()
    .split(/[\s,，。.!！？、;；:：\-_/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return tokens.length <= 2 && compact.length <= 12;
}

function detectSubjectType(idea: string): QuickSubjectType {
  const text = idea.toLowerCase();
  if (hasAny(text, ["机甲", "mecha", "exo", "外骨骼", "战甲"])) return "mecha";
  if (hasAny(text, ["机械臂", "生产线", "工厂设备", "装配线", "机床", "工业设备", "流水线"])) {
    return "industrial_device";
  }
  if (hasAny(text, ["汽车", "卡车", "巴士", "摩托", "列车", "飞机", "飞艇", "飞船", "船", "舰", "载具"])) {
    return "vehicle";
  }
  if (hasAny(text, ["建筑", "塔", "城堡", "大楼", "街区", "空间站", "寺", "庙", "阁", "楼", "桥"])) return "architecture";
  if (hasAny(text, ["奇幻", "魔法", "神话", "龙", "精灵"])) return "scene";
  if (hasAny(text, ["人仔", "角色", "人物", "npc"])) return "character";
  if (hasAny(text, ["场景", "街景", "基地", "营地", "夜巡", "救援站"])) return "scene";
  return "unknown";
}

function detectIntentType(idea: string, direction: QuickDirection | ""): QuickIntentType {
  const text = idea.toLowerCase();
  if (direction === "display" || hasAny(text, ["展示", "陈列", "收藏"])) return "display";
  if (hasAny(text, ["礼品", "送礼", "纪念"])) return "gift";
  if (hasAny(text, ["系列", "多款", "宇宙", "世界观"])) return "series";
  if (hasAny(text, ["单品", "爆款", "主打"])) return "single_product";
  return "exploration";
}

function detectAudience(idea: string): QuickAudienceGuess {
  const text = idea.toLowerCase();
  if (hasAny(text, ["儿童", "小朋友", "kid"])) return "kids";
  if (hasAny(text, ["亲子", "家庭"])) return "family";
  if (hasAny(text, ["成人", "收藏", "展示级"])) return "adult";
  if (hasAny(text, ["青少年", "teen"])) return "teen";
  return "all";
}

function completeThemeForShortInput(idea: string, subjectType: QuickSubjectType) {
  const text = idea.toLowerCase();
  if (hasAny(text, ["湖", "山", "泉", "景区", "地标", "古城", "公园", "广场"])) return "城市地标";
  if (hasAny(text, ["寺", "庙", "阁", "楼", "桥"])) return "古建/景区建筑";
  if (hasAny(text, ["文创", "纪念", "礼品", "伴手礼"])) return "城市文创";
  if (subjectType === "vehicle") return "载具主题";
  if (subjectType === "mecha") return "机甲主题";
  if (subjectType === "industrial_device") return "工业设备主题";
  if (subjectType === "architecture") return "古建/景区建筑";
  if (subjectType === "scene") return "场景主题";
  if (hasAny(text, ["奇幻", "魔法", "神话"])) return "奇幻场景";
  return "展示摆件主题";
}

function completeIntentForShortInput(input: {
  direction: QuickDirection | "";
  subjectType: QuickSubjectType;
  rawIdea: string;
}) {
  const text = input.rawIdea.toLowerCase();
  if (hasAny(text, ["文创", "礼品", "纪念", "伴手礼"])) return "文创礼品";
  if (input.direction === "display") return "展示向";
  if (input.direction === "cost") return "小型单品试水";
  if (input.direction === "production") return "继续探索并准备专业化";
  if (hasAny(text, ["系列", "套系", "周边"])) return "系列化方向";
  if (input.subjectType === "architecture" || input.subjectType === "scene") return "文创礼品 / 展示向";
  return "继续探索";
}

function completeDefaultScenario(input: {
  direction: QuickDirection | "";
  subjectType: QuickSubjectType;
  scale: QuickScalePreference | "";
  rawIdea: string;
}) {
  const text = input.rawIdea.toLowerCase();
  if (hasAny(text, ["湖", "景区", "地标", "泉", "古城"])) return "文创纪念";
  if (hasAny(text, ["礼品", "伴手礼", "纪念"])) return "礼品小单品";
  if (input.scale === "large") return "完整主体展示";
  if (input.direction === "cost") return "小体量试水";
  if (input.subjectType === "vehicle") return "桌面展示";
  return "桌面展示";
}

function inferScaleForUnspecified(input: {
  rawIdea: string;
  subjectType: QuickSubjectType;
  intentType: QuickIntentType;
}): QuickScalePreference {
  const text = input.rawIdea.toLowerCase();
  if (hasAny(text, ["地标", "文创", "礼品", "纪念", "景区", "泉", "湖"])) return "small";
  if (hasAny(text, ["街区", "微景观", "小场景"])) return "medium";
  if (hasAny(text, ["完整", "大载具", "巨型", "机甲", "大建筑", "综合体"])) return "large";
  if (input.subjectType === "mecha" || input.subjectType === "industrial_device") return "medium";
  if (input.subjectType === "architecture") return "medium";
  if (input.intentType === "series") return "medium";
  return "small";
}

function decidePrimaryGoal(input: {
  direction: QuickDirection | "";
  intent: QuickIntentType;
  subject: QuickSubjectType;
  scale: QuickScalePreference;
}): QuickPath {
  if (input.scale === "large") return "professional_upgrade";
  if (input.scale === "small") return "small_batch";
  if (input.direction === "display") return "creator_plan";
  if (input.direction === "cost") return "small_batch";
  if (input.direction === "production") return "professional_upgrade";
  if (input.intent === "series" || input.subject === "industrial_device") return "professional_upgrade";
  if (input.intent === "display") return "creator_plan";
  return "small_batch";
}

function buildAntiDriftRules(summary: {
  subjectType: QuickSubjectType;
  rawIdea: string;
}) {
  const rules = [
    "必须保持积木化（brick-built）表达，不转写实材质。",
    "不得生成海报大字、Logo墙或宣传海报版式。",
    "不得把主题改写为与原创意无关题材。"
  ];
  if (summary.subjectType !== "mecha") {
    rules.push("无机甲信号时，禁止出现机甲、战甲、巨型机器人。");
  }
  if (summary.subjectType !== "vehicle") {
    rules.push("无载具信号时，禁止把主体改成车辆或舰船。");
  }
  return rules;
}

function mapSubjectToQueryCategory(subject: QuickSubjectType) {
  if (subject === "vehicle") return "vehicle";
  if (subject === "mecha" || subject === "industrial_device") return "mechanism";
  if (subject === "architecture") return "architecture";
  if (subject === "character") return "character";
  return "scene";
}

function mapStyleToQueryStyle(style: QuickStyle | "") {
  if (style === "mechanical") return "industrial";
  if (style === "fantasy") return "fantasy";
  if (style === "cute") return "cute";
  if (style === "realistic") return "minimal";
  return "minimal";
}

function mapAudienceToQueryAudience(audience: QuickAudienceGuess) {
  if (audience === "kids") return "kids";
  if (audience === "family") return "family";
  if (audience === "adult") return "adult";
  if (audience === "teen") return "teen";
  return "all";
}

function mapDirectionToSize(direction: QuickDirection | "") {
  if (direction === "display") return "display";
  if (direction === "cost") return "small";
  return "medium";
}

function mapScaleToSize(scale: QuickScalePreference) {
  if (scale === "small") return "small";
  if (scale === "large") return "large";
  return "medium";
}

function mapPrimaryGoalToRecommendedText(path: QuickPath) {
  if (path === "creator_plan") return "提交原创计划评审";
  if (path === "small_batch") return "申请打样可行性评估";
  return "升级专业方案";
}

function buildThemeTags(summary: QuickGenerationSummary) {
  const tags: string[] = [summary.subjectType, summary.intentType].filter((item) => item !== "unknown");
  if (summary.directionBias) tags.push(summary.directionBias);
  if (summary.styleBias) tags.push(summary.styleBias);
  tags.push(`scale:${summary.effectiveScale}`);
  return tags;
}

function buildValueTags(summary: QuickGenerationSummary) {
  const tags: string[] = [];
  if (summary.directionBias === "display") tags.push("视觉锚点", "展示叙事");
  if (summary.directionBias === "cost") tags.push("低门槛试水", "结构收敛");
  if (summary.directionBias === "production") tags.push("标准化潜力", "可复制结构");
  if (summary.styleBias === "cute") tags.push("亲和表达");
  if (summary.styleBias === "mechanical") tags.push("结构表达");
  if (summary.styleBias === "realistic") tags.push("克制轮廓");
  if (summary.styleBias === "fantasy") tags.push("主题氛围");
  if (summary.hasReferenceAnchor) tags.push("参考图风格锚定", "场景锚定");
  if (summary.correctionIntent) tags.push("快速纠偏");
  if (summary.scenicSpotName) tags.push("景区知识锚定");
  if (summary.isShortInput) tags.push("短输入补全");
  return tags.slice(0, 4);
}

function buildRiskTags(summary: QuickGenerationSummary) {
  const tags: string[] = [];
  if (summary.directionBias === "display") tags.push("装饰过载风险");
  if (summary.directionBias === "cost") tags.push("识别度不足风险");
  if (summary.directionBias === "production") tags.push("接口标准不足风险");
  if (summary.subjectType === "unknown") tags.push("题材边界模糊风险");
  if (!summary.hasReferenceAnchor) tags.push("风格锚点不足风险");
  return tags.slice(0, 3);
}

export function buildQuickGenerationSummary(input: QuickEntryInput): QuickGenerationSummary {
  const rawIdea = normalizeIdea(input.idea);
  const subjectType = detectSubjectType(rawIdea);
  const intentType = detectIntentType(rawIdea, input.direction);
  const audienceGuess = detectAudience(rawIdea);
  const isShortInput = isShortIdeaInput(rawIdea);
  const completedTheme = isShortInput ? completeThemeForShortInput(rawIdea, subjectType) : "";
  const completedIntent = isShortInput
    ? completeIntentForShortInput({ direction: input.direction, subjectType, rawIdea })
    : "";
  const effectiveScale = input.scale || inferScaleForUnspecified({ rawIdea, subjectType, intentType });
  const defaultScenario = isShortInput
    ? completeDefaultScenario({ direction: input.direction, subjectType, scale: effectiveScale, rawIdea })
    : "常规创意验证";
  const hasReferenceAnchor = Boolean(input.referenceImage.trim());
  const correctionIntent = (input.correctionIntent || "").trim();
  const scenicMatch = matchScenicSpotByIdea(rawIdea);
  const scenicSpotName = scenicMatch?.spotName ?? "";
  const scenicHighlights = scenicMatch?.highlights ?? [];
  const referenceAnchorNote = hasReferenceAnchor
    ? "存在参考图锚点：优先对齐风格与场景氛围，不做结构复刻。"
    : "无参考图锚点：按文本创意做方向判断。";
  const primaryGoal = decidePrimaryGoal({
    direction: input.direction,
    intent: intentType,
    subject: subjectType,
    scale: effectiveScale
  });

  return {
    rawIdea,
    subjectType,
    intentType,
    directionBias: input.direction,
    styleBias: input.style,
    scaleBias: input.scale,
    effectiveScale,
    audienceGuess,
    primaryGoal,
    isShortInput,
    completedTheme,
    completedIntent,
    defaultScenario,
    hasReferenceAnchor,
    referenceAnchorNote,
    correctionIntent,
    scenicSpotName,
    scenicHighlights,
    antiDriftRules: buildAntiDriftRules({ subjectType, rawIdea })
  };
}

export function buildQuickKnowledgePack(summary: QuickGenerationSummary): QuickKnowledgePack {
  const anchors = pickSimilarReferences({
    category: mapSubjectToQueryCategory(summary.subjectType),
    style: mapStyleToQueryStyle(summary.styleBias),
    sizeTarget: mapScaleToSize(summary.effectiveScale) || mapDirectionToSize(summary.directionBias),
    audience: mapAudienceToQueryAudience(summary.audienceGuess),
    designBrief: [
      summary.rawIdea,
      summary.scenicSpotName ? `景区命中：${summary.scenicSpotName}` : "",
      summary.scenicHighlights.length > 0 ? `景区要点：${summary.scenicHighlights.join("、")}` : "",
      summary.completedTheme ? `补全主题：${summary.completedTheme}` : "",
      summary.correctionIntent ? `纠偏意图：${summary.correctionIntent}` : "",
      summary.hasReferenceAnchor ? "存在参考图锚点，优先对齐风格与场景" : ""
    ].filter(Boolean),
    bomDraft: [],
    risks: [],
    recommendedNextStep: mapPrimaryGoalToRecommendedText(summary.primaryGoal),
    generationMode: null
  })
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title,
      referenceType: item.referenceType,
      whyRelevant: item.whyRelevant,
      takeaway: item.takeaway
    }));

  return {
    themeTags: buildThemeTags(summary),
    valueTags: buildValueTags(summary),
    riskTags: buildRiskTags(summary),
    anchors
  };
}

function removeDriftWords(text: string, summary: QuickGenerationSummary) {
  let cleaned = text;
  if (summary.subjectType !== "mecha") {
    cleaned = cleaned.replace(/机甲|战甲|巨型机器人|Mecha/gi, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

export function postProcessQuickCopy(
  input: QuickCopyDraft,
  summary: QuickGenerationSummary
) {
  const topJudgement = trimToChars(removeDriftWords(input.topJudgement, summary), 40);
  const conceptPreview = trimToChars(removeDriftWords(input.conceptPreview, summary), 110);
  const recommendedReason = trimToChars(removeDriftWords(input.recommendedReason, summary), 40);
  return { topJudgement, conceptPreview, recommendedReason };
}

function recommendedFitText(path: QuickPath) {
  if (path === "small_batch") return "先做小批量文创单品试水";
  if (path === "creator_plan") return "先做原创计划 / 众筹概念款";
  return "先升级成完整专业方案";
}

function subjectLabel(subjectType: QuickSubjectType) {
  if (subjectType === "vehicle") return "载具";
  if (subjectType === "industrial_device") return "工业设备";
  if (subjectType === "mecha") return "机甲";
  if (subjectType === "architecture") return "建筑";
  if (subjectType === "character") return "角色";
  if (subjectType === "scene") return "场景";
  return "创意主题";
}

function directionHint(direction: QuickDirection | "") {
  if (direction === "display") return "更适合先突出展示效果和画面记忆点";
  if (direction === "cost") return "更适合先做小体量版本，控制成本和复杂度";
  if (direction === "production") return "更适合先按可落地思路梳理结构";
  return "先按最容易看出作品气质的方向推进";
}

function scaleHint(scale: QuickScalePreference) {
  if (scale === "small") return "体量偏小，更像礼品化或桌面小摆件。";
  if (scale === "large") return "体量偏大，更适合完整主体和更丰富细节。";
  return "体量偏中，更适合完整微景观或小型套装表达。";
}

function shouldUseProductShowcaseMode(summary: QuickGenerationSummary) {
  const text = summary.rawIdea.toLowerCase();
  const correction = summary.correctionIntent.toLowerCase();
  const wantsWaterOrScene = hasAny(correction, ["泉池", "喷泉", "水景", "亭台", "场景", "完整地标"]);
  if (wantsWaterOrScene) return false;
  if (summary.scenicSpotName) return false;
  return (
    summary.effectiveScale === "small" ||
    summary.primaryGoal === "small_batch" ||
    summary.intentType === "gift" ||
    summary.intentType === "single_product" ||
    hasAny(text, ["文创", "礼品", "纪念", "售卖", "小单品", "伴手礼", "周边", "店里卖"])
  );
}

export function decideQuickImageMode(summary: QuickGenerationSummary): QuickImageMode {
  return shouldUseProductShowcaseMode(summary) ? "product_showcase_with_packaging" : "concept_preview";
}

function productTypeLine(summary: QuickGenerationSummary) {
  if (summary.completedTheme.includes("文旅文创")) {
    return "产品类型：小型城市地标文创积木单品，适合景区文创店售卖。";
  }
  if (summary.intentType === "gift") {
    return "产品类型：可送礼的小体量文创积木礼品。";
  }
  if (summary.intentType === "single_product" || summary.primaryGoal === "small_batch") {
    return "产品类型：小单品零售友好的积木文创商品。";
  }
  return "产品类型：适合桌面展示的可收藏积木单品。";
}

function productGoalLine() {
  return "产品感目标：product concept presentation, giftable cultural souvenir style, collectible desk display product, small retail-friendly cultural product。";
}

export function buildRuleBasedQuickResultFromSummary(input: {
  summary: QuickGenerationSummary;
  knowledge: QuickKnowledgePack;
}): QuickEntryResult {
  const referenceHint = input.summary.hasReferenceAnchor ? "，我也参考了你给的方向图" : "";
  const correctionHint = input.summary.correctionIntent ? `，并按「${input.summary.correctionIntent}」收敛了方向` : "";
  const scenicHint = input.summary.scenicSpotName ? `，并参考了「${input.summary.scenicSpotName}」的核心特征` : "";
  const shortInputHint = input.summary.isShortInput ? `这个想法我按「${input.summary.completedTheme}」补成了可落地的表达。` : "";
  const primaryAnchor = input.knowledge.anchors[0]?.title ?? "同类参考";
  const topJudgement = trimToChars(
    `这个想法挺有画面感，更像一个${subjectLabel(input.summary.subjectType)}方向的作品${referenceHint}${correctionHint}${scenicHint}。`,
    40
  );
  const conceptPreview = trimToChars(
    `这会是一件偏${input.summary.completedTheme || subjectLabel(input.summary.subjectType)}气质的作品，第一眼就能看到主题记忆点。亮点在于主体识别度和场景感比较明确，${scaleHint(
      input.summary.effectiveScale
    )}${shortInputHint}它比较适合放在「${input.summary.defaultScenario}」这类场景，也可以参考「${primaryAnchor}」的表达节奏。`,
    110
  );
  const recommendedReason = trimToChars(
    input.summary.primaryGoal === "creator_plan"
      ? "这个题材更看重故事共鸣，先看真实用户反馈会更稳。"
      : input.summary.primaryGoal === "small_batch"
        ? "这类方向适合先小批量试水，能更快看到市场接受度。"
        : "它的潜力在完整度，补齐结构约束后会更容易落地。",
    40
  );

  return {
    topJudgement,
    conceptTitle: `${input.summary.rawIdea}（AI 轻量概念）`,
    conceptPreview,
    recommendedFit: recommendedFitText(input.summary.primaryGoal),
    recommendedReason,
    suggestedPath: input.summary.primaryGoal
  };
}

export function buildImagePromptFromSummary(input: {
  summary: QuickGenerationSummary;
  knowledge: QuickKnowledgePack;
  referenceImage?: string;
  imageMode: QuickImageMode;
}) {
  const referenceHint = input.referenceImage
    ? `参考图仅作氛围参考：${input.referenceImage}`
    : "无参考图，按创意摘要构图。";
  const anchors = input.knowledge.anchors.map((item) => item.title).slice(0, 3).join("、");

  if (input.imageMode === "product_showcase_with_packaging") {
    return [
      "目标：文创商品概念展示图（不是广告海报，不是最终商拍图）。",
      "必须是 brick-built, blocky toy style, colorful plastic bricks。",
      "画面优先无字图：不要在图内出现大标题、副标题、地名、项目名或任何水印文字。",
      // 1) 产品类型
      productTypeLine(input.summary),
      // 2) 主体内容
      `主体内容：以「${input.summary.rawIdea}」为核心，强调地标/主题识别度与小体量产品表达。`,
      // 3) 产品感目标
      productGoalLine(),
      // 4) 包装盒要求
      "包装盒要求：可出现产品本体与包装盒同框，但不要强制固定构图；包装盒需有文创礼品盒气质，盒面简洁有商品设计感，不是白色运输箱。",
      // 5) 场景要求
      "场景要求：允许侧向视角、三分构图或近景特写，不要总是正面居中构图；简洁桌面陈列，温和室内光线，背景干净不喧宾夺主。",
      `规模偏好：${input.summary.scaleBias || "未指定"}，当前按${input.summary.effectiveScale}档执行。`,
      // 6) 积木化约束
      "积木化约束：brick-built style, interlocking brick texture, collectible building-block product look；不要生成普通建筑渲染或非积木商品图。",
      // 7) 负面约束
      "负面约束：no large poster text, no ad campaign layout, no promotional banner, no giant title overlay, no exploded packaging dieline, no shelf full of products, no complex supermarket scene, no human hands holding the product, avoid pure blank shipping box.",
      `主体类型：${subjectLabel(input.summary.subjectType)}。`,
      `使用场景：${input.summary.intentType}。`,
      input.summary.isShortInput
        ? `短输入补全：主题按「${input.summary.completedTheme}」，意图按「${input.summary.completedIntent}」，场景按「${input.summary.defaultScenario}」。`
        : "输入完整度：按原始创意细化。",
      `方向偏好：${input.summary.directionBias || "待判断"}。`,
      `风格偏好：${input.summary.styleBias || "待判断"}。`,
      input.summary.scenicSpotName ? `景区锚点：${input.summary.scenicSpotName}。` : "",
      input.summary.scenicHighlights.length > 0 ? `景区要点：${input.summary.scenicHighlights.join("、")}。` : "",
      input.summary.correctionIntent ? `本轮纠偏意图：${input.summary.correctionIntent}。` : "",
      input.summary.referenceAnchorNote,
      `视觉重点：${directionHint(input.summary.directionBias)}。`,
      `参考锚点：${anchors || "无"}`,
      `防跑偏规则：${input.summary.antiDriftRules.join("；")}`,
      "诚实边界：仅用于创意方向和商品表达参考，不代表真实包装结构、印刷规格或最终打样结果。",
      referenceHint
    ].join("\n");
  }

  return [
    "请生成一张积木/MOC创意预览图，仅用于方向判断。",
    "必须是 brick-built, blocky toy style, colorful plastic bricks。",
    "画面优先无字图：不要在图内出现大标题、副标题、地名、项目名或任何水印文字。",
    "构图应更像创意方向预览图，不要做宣传海报或封面广告版式。",
    "构图多样化：避免总是正面居中单一视角，可采用侧向视角、三分构图或局部特写。",
    "展示重点：优先表现创意方向、主体轮廓与场景氛围。",
    `主体类型：${subjectLabel(input.summary.subjectType)}。`,
    `使用场景：${input.summary.intentType}。`,
    input.summary.isShortInput
      ? `短输入补全：主题按「${input.summary.completedTheme}」，意图按「${input.summary.completedIntent}」，场景按「${input.summary.defaultScenario}」。`
      : "输入完整度：按原始创意细化。",
    `方向偏好：${input.summary.directionBias || "待判断"}。`,
    `风格偏好：${input.summary.styleBias || "待判断"}。`,
    input.summary.scenicSpotName ? `景区锚点：${input.summary.scenicSpotName}。` : "",
    input.summary.scenicHighlights.length > 0 ? `景区要点：${input.summary.scenicHighlights.join("、")}。` : "",
    input.summary.correctionIntent ? `本轮纠偏意图：${input.summary.correctionIntent}。` : "",
    `规模偏好：${input.summary.scaleBias || "未指定"}，当前按${input.summary.effectiveScale}档执行。`,
    input.summary.referenceAnchorNote,
    `视觉重点：${directionHint(input.summary.directionBias)}。`,
    `参考锚点：${anchors || "无"}`,
    "禁止事项：不生成海报字、不出现品牌Logo墙、不改写主体题材、不过度排版装饰文字。",
    "诚实边界：仅用于创意方向和商品表达参考，不代表真实包装结构、印刷规格或最终打样结果。",
    `防跑偏规则：${input.summary.antiDriftRules.join("；")}`,
    `创意原句：${input.summary.rawIdea}`,
    referenceHint
  ].join("\n");
}
