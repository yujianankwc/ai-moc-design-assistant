import type { ProjectFormPayload } from "@/types/project";
import type { GenerationMode } from "@/types/generation-mode";

type BomGroup = {
  item: string;
  estimate: string;
  note: string;
};

export type GeneratedProjectOutput = {
  design_summary: string;
  design_positioning: string;
  build_difficulty: string;
  structure_notes: string;
  highlight_points: string[];
  bom_groups: BomGroup[];
  substitution_suggestions: string;
  risk_notes: string;
  production_hint: string;
  production_score: number;
  recommended_next_step: string;
  internal_recommendation: string;
  recommended_service: string;
  editable_version: string;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function asBomGroups(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const group = item as Record<string, unknown>;
      return {
        item: asText(group?.item),
        estimate: asText(group?.estimate),
        note: asText(group?.note)
      };
    })
    .filter((item) => item.item && item.estimate);
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 50;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function recommendServiceByScore(score: number) {
  if (score >= 80) return "提交原创计划评审";
  if (score >= 60) return "申请打样可行性评估";
  if (score >= 40) return "申请 BOM 快速校对";
  return "先补充方案信息 / 先收敛结构";
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("模型返回结果不是有效 JSON");
  }
}

function extractJsonObjectFromText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("模型返回中未找到 JSON 对象");
  }
  return text.slice(start, end + 1);
}

function normalizeOutput(raw: Record<string, unknown>): GeneratedProjectOutput {
  const productionScore = clampScore(raw.production_score);
  const highlightPoints = asStringArray(raw.highlight_points);
  const bomGroups = asBomGroups(raw.bom_groups);
  const recommendedServiceRaw = asText(raw.recommended_service);

  const output: GeneratedProjectOutput = {
    design_summary: asText(raw.design_summary),
    design_positioning: asText(raw.design_positioning),
    build_difficulty: asText(raw.build_difficulty),
    structure_notes: asText(raw.structure_notes),
    highlight_points: highlightPoints,
    bom_groups: bomGroups,
    substitution_suggestions: asText(raw.substitution_suggestions),
    risk_notes: asText(raw.risk_notes),
    production_hint: asText(raw.production_hint),
    production_score: productionScore,
    recommended_next_step: asText(raw.recommended_next_step),
    internal_recommendation: asText(raw.internal_recommendation),
    recommended_service:
      recommendedServiceRaw || recommendServiceByScore(productionScore),
    editable_version: asText(raw.editable_version)
  };

  const requiredTextFields: Array<keyof GeneratedProjectOutput> = [
    "design_summary",
    "design_positioning",
    "build_difficulty",
    "structure_notes",
    "substitution_suggestions",
    "risk_notes",
    "production_hint",
    "recommended_next_step",
    "internal_recommendation"
  ];

  for (const field of requiredTextFields) {
    if (!output[field]) {
      throw new Error(`模型结果缺少字段: ${field}`);
    }
  }

  if (output.highlight_points.length === 0) {
    throw new Error("模型结果缺少字段: highlight_points");
  }
  if (output.bom_groups.length === 0) {
    throw new Error("模型结果缺少字段: bom_groups");
  }

  return output;
}

export async function generateProjectOutputWithAI(
  payload: ProjectFormPayload,
  mode?: GenerationMode
): Promise<GeneratedProjectOutput> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey || !model) {
    throw new Error("缺少 AI 配置，请检查 AI_API_KEY 与 AI_MODEL");
  }

  const systemPrompt =
    "你是积木/MOC 设计顾问。请仅返回 JSON，不要输出额外解释。";

  const modePromptByKey: Record<GenerationMode, string> = {
    display_focused:
      "本次目标为偏展示版：请优先提升视觉表现、装饰性和展示叙事完整度，同时保持可搭建。",
    cost_focused:
      "本次目标为偏成本版：请优先控制成本，强调标准件替代、零件复用与结构复杂度压缩。",
    production_focused:
      "本次目标为偏量产版：请优先考虑结构稳定性、标准化程度和量产可行性。"
  };

  const modeInstruction = mode ? `\n生成目标模式：${mode}\n${modePromptByKey[mode]}` : "";

  const userPrompt = `
请基于以下项目输入，生成结构化方案结果。

项目输入:
${JSON.stringify(payload, null, 2)}
${modeInstruction}

请严格输出 JSON，字段必须包含：
- design_summary: string
- design_positioning: string
- build_difficulty: string
- structure_notes: string
- highlight_points: string[] (至少3条)
- bom_groups: { item: string, estimate: string, note: string }[] (至少3组)
- substitution_suggestions: string
- risk_notes: string
- production_hint: string
- production_score: number (0-100，可按你的理解给参考值，最终以前端规则分为准)
- recommended_next_step: string (自然语言建议，最终主推荐动作以后端规则为准)
- internal_recommendation: string
- recommended_service: string (可给参考建议，最终以后端规则结果为准)
- editable_version: string
`.trim();

  const callModel = async (useJsonResponseFormat: boolean) => {
    const body: {
      model: string;
      temperature: number;
      messages: Array<{ role: "system" | "user"; content: string }>;
      response_format?: { type: "json_object" };
    } = {
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: useJsonResponseFormat
            ? userPrompt
            : `${userPrompt}\n\n如果模型不支持 json_object 参数，也必须直接输出一个 JSON 对象，不要输出其他文本。`
        }
      ]
    };

    if (useJsonResponseFormat) {
      body.response_format = { type: "json_object" };
    }

    return fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  };

  let response = await callModel(true);
  let rawBodyText = "";

  if (!response.ok) {
    rawBodyText = await response.text();
    const unsupportedJsonMode =
      response.status === 400 &&
      (rawBodyText.includes("response_format.type") ||
        rawBodyText.includes("json_object is not supported"));

    if (unsupportedJsonMode) {
      response = await callModel(false);
    } else {
      throw new Error(`AI 调用失败: ${response.status} ${rawBodyText}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 调用失败: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI 未返回有效内容");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(content);
  } catch {
    const extracted = extractJsonObjectFromText(content);
    parsed = parseJsonObject(extracted);
  }

  return normalizeOutput(parsed);
}
