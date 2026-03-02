import type { QuickKnowledgePack, QuickGenerationSummary } from "@/lib/quick-generation-pipeline";

type QuickCopyResponse = {
  topJudgement: string;
  conceptPreview: string;
  recommendedReason: string;
};

function parseJson(text: string) {
  try {
    return JSON.parse(text) as QuickCopyResponse;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("轻量文案模型返回格式无效。");
    }
    return JSON.parse(text.slice(start, end + 1)) as QuickCopyResponse;
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function generateQuickCopyWithAI(input: {
  summary: QuickGenerationSummary;
  knowledge: QuickKnowledgePack;
  regenerateToken?: string;
}): Promise<QuickCopyResponse> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey || !model) {
    throw new Error("缺少 AI 配置，请检查 AI_API_KEY 与 AI_MODEL");
  }

  const systemPrompt =
    "你是积木/MOC创意顾问。你的任务是把用户输入理解成可落地的产品概念描述，并像在和用户一起看想法。请用自然、人话、克制但有温度的短句。只返回JSON，不要解释，不要长文。";
  const userPrompt = `
你将基于产品整理后的创意摘要，输出轻量结果文案。

摘要对象:
${JSON.stringify(input.summary, null, 2)}

知识增强:
${JSON.stringify(
    {
      themeTags: input.knowledge.themeTags,
      valueTags: input.knowledge.valueTags,
      riskTags: input.knowledge.riskTags,
      anchors: input.knowledge.anchors.map((item) => ({
        title: item.title,
        referenceType: item.referenceType,
        takeaway: item.takeaway
      }))
    },
    null,
    2
  )}

${input.regenerateToken ? `本次为手动重生成，请在不改变结论的前提下尝试不同表达。重生成标识：${input.regenerateToken}` : ""}

只输出JSON，字段必须为：
- topJudgement: 一句判断，<= 40字。语气更像“这个想法我看到了什么”，先有轻微共情，再说它更像什么产品/作品。
- conceptPreview: 2-3句概念说明，总长<= 120字。要包含“作品形态 + 亮点 + 使用/展示/送礼场景”，让人有画面感。
- recommendedReason: 一句原因，<= 40字。要回答“为什么建议走这条路”，原因贴题、自然，不要口号。

补充要求：
- 如果是短输入（isShortInput=true），必须使用摘要中的 completedTheme/completedIntent/defaultScenario 进行最小补全，保证文案完整可读。
- 如果有参考图锚点（hasReferenceAnchor=true），文案需体现“已结合参考方向”，但不得过度解读参考图结构。
- 如果存在纠偏意图（correctionIntent 非空），文案要明确朝该方向收敛，不要继续发散到其他题材。
- 短输入时禁止空泛句式（如“值得继续探索”这类无信息句），必须明确主题类别与场景方向。
- 必须体现规模偏好（scaleBias/effectiveScale）对应的尺度语气，不要随意猜大小。
- 文案风格要像“作品说明 + 方向建议”，避免系统词：方向明确、深化路线、补全最小主题、默认场景推进。
- 推荐使用自然表达：这个想法……、亮点在于……、一眼会让人想到……、更适合先做成……、如果你想继续……。
- 不要只给抽象评价，必须给出你理解后的“产品化指向”（例如摆件、礼品套装、桌面陈列、文创单品等）。

禁止：
- 输出长篇分析
- 改写主体题材
- 输出与积木/MOC无关内容
- 夸张吹捧、营销口号、绝对化承诺（如“一定爆款”“必火”）
`.trim();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: input.regenerateToken ? 0.45 : 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`轻量文案生成失败: ${response.status} ${raw}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("轻量文案生成失败：模型未返回内容。");
  }

  const parsed = parseJson(content) as Record<string, unknown>;
  const topJudgement = normalizeText(parsed.topJudgement);
  const conceptPreview = normalizeText(parsed.conceptPreview);
  const recommendedReason = normalizeText(parsed.recommendedReason);
  if (!topJudgement || !conceptPreview || !recommendedReason) {
    throw new Error("轻量文案生成失败：字段缺失。");
  }

  return { topJudgement, conceptPreview, recommendedReason };
}
