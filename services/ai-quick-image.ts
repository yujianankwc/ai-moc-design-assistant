import { buildImagePromptFromSummary } from "@/lib/quick-generation-pipeline";
import type {
  QuickGenerationSummary,
  QuickImageMode,
  QuickKnowledgePack
} from "@/lib/quick-generation-pipeline";

type GenerateQuickPreviewImageInput = {
  summary: QuickGenerationSummary;
  knowledge: QuickKnowledgePack;
  imageMode: QuickImageMode;
  referenceImage?: string;
  regenerateToken?: string;
};

function toDataUrl(base64: string) {
  return `data:image/png;base64,${base64}`;
}

export async function generateQuickPreviewImage(input: GenerateQuickPreviewImageInput) {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const imageModel = process.env.AI_IMAGE_MODEL || process.env.AI_MODEL;
  const imageSize = process.env.AI_IMAGE_SIZE || "2048x2048";

  if (!apiKey || !imageModel) {
    throw new Error("缺少图像生成配置，请检查 AI_API_KEY 与 AI_IMAGE_MODEL/AI_MODEL。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const prompt = `${buildImagePromptFromSummary(input)}${
      input.regenerateToken ? `\n构图变化标识：${input.regenerateToken}` : ""
    }`;
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: imageModel,
        prompt,
        size: imageSize,
        response_format: "url",
        sequential_image_generation: "disabled",
        stream: false,
        watermark: true
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`图像生成失败: ${response.status} ${rawText}`);
    }

    const parsed = JSON.parse(rawText) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };
    const first = parsed.data?.[0];
    const url = typeof first?.url === "string" ? first.url.trim() : "";
    const b64 = typeof first?.b64_json === "string" ? first.b64_json.trim() : "";

    if (url) return url;
    if (b64) return toDataUrl(b64);
    throw new Error("图像生成失败：未返回可用图片数据。");
  } finally {
    clearTimeout(timeout);
  }
}

