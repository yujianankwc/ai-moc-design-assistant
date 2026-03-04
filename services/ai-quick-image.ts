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
  imageModelAlias?: "default" | "nano_banner" | "nano_banana";
};

type QuickImageAlias = "default" | "nano_banner" | "nano_banana";

function toDataUrl(base64: string) {
  return `data:image/png;base64,${base64}`;
}

function isHttpUrl(value?: string) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function pickImageConfig(alias: QuickImageAlias) {
  const defaultConfig = {
    apiKey: process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_IMAGE_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.AI_IMAGE_MODEL || process.env.AI_MODEL || "",
    endpoint: process.env.AI_IMAGE_ENDPOINT || ""
  };

  if (alias === "nano_banana" || alias === "nano_banner") {
    return {
      apiKey:
        process.env.AI_IMAGE_API_KEY_NANO_BANANA ||
        process.env.AI_IMAGE_API_KEY_NANO_BANNER ||
        defaultConfig.apiKey,
      baseUrl:
        process.env.AI_IMAGE_BASE_URL_NANO_BANANA ||
        process.env.AI_IMAGE_BASE_URL_NANO_BANNER ||
        defaultConfig.baseUrl,
      model:
        process.env.AI_IMAGE_MODEL_NANO_BANANA ||
        process.env.AI_IMAGE_MODEL_NANO_BANNER ||
        defaultConfig.model,
      endpoint:
        process.env.AI_IMAGE_ENDPOINT_NANO_BANANA ||
        process.env.AI_IMAGE_ENDPOINT_NANO_BANNER ||
        defaultConfig.endpoint
    };
  }

  return defaultConfig;
}

function pickImageSize(alias: QuickImageAlias) {
  const defaultSize = process.env.AI_IMAGE_SIZE || "2048x2048";
  if (alias === "nano_banana" || alias === "nano_banner") {
    // Nano channel is generally more stable with lower default size.
    return process.env.AI_IMAGE_SIZE_NANO_BANANA || process.env.AI_IMAGE_SIZE_NANO_BANNER || "1024x1024";
  }
  const normalized = defaultSize.trim().toLowerCase();
  const matched = normalized.match(/^(\d+)\s*x\s*(\d+)$/);
  if (matched) {
    const width = Number(matched[1]);
    const height = Number(matched[2]);
    // Seedream-like channels may reject sizes below 3,686,400 pixels.
    if (Number.isFinite(width) && Number.isFinite(height) && width * height < 3_686_400) {
      return "2048x2048";
    }
  }
  return defaultSize;
}

function parseTimeoutMs(alias: QuickImageAlias) {
  const aliasTimeoutRaw =
    alias === "nano_banana" || alias === "nano_banner"
      ? process.env.AI_IMAGE_TIMEOUT_MS_NANO_BANANA || process.env.AI_IMAGE_TIMEOUT_MS_NANO_BANNER
      : undefined;
  const raw = aliasTimeoutRaw || process.env.AI_IMAGE_TIMEOUT_MS || "90000";
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 30000) return 90000;
  return Math.min(parsed, 300000);
}

export async function generateQuickPreviewImage(input: GenerateQuickPreviewImageInput) {
  const defaultAlias =
    process.env.AI_IMAGE_DEFAULT_ALIAS === "nano_banner" || process.env.AI_IMAGE_DEFAULT_ALIAS === "nano_banana"
      ? process.env.AI_IMAGE_DEFAULT_ALIAS
      : "default";
  const resolvedAlias = input.imageModelAlias || defaultAlias;
  const { apiKey, baseUrl, model: imageModel, endpoint } = pickImageConfig(resolvedAlias);
  const imageSize = pickImageSize(resolvedAlias);
  const timeoutMs = parseTimeoutMs(resolvedAlias);
  const requestUrl = endpoint || `${baseUrl}/images/generations`;

  if (!apiKey || !imageModel) {
    throw new Error("缺少图像生成配置，请检查对应模型别名的 AI_IMAGE_* 配置。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const prompt = `${buildImagePromptFromSummary(input)}${
      input.regenerateToken ? `\n构图变化标识：${input.regenerateToken}` : ""
    }`;
    const bodyPayload: Record<string, unknown> = {
      model: imageModel,
      prompt,
      size: imageSize,
      response_format: "url"
    };
    // Nano endpoint accepts additional generation controls.
    if (resolvedAlias === "nano_banana" || resolvedAlias === "nano_banner") {
      bodyPayload.sequential_image_generation = "disabled";
      bodyPayload.stream = false;
      bodyPayload.watermark = true;
    }
    if ((resolvedAlias === "nano_banana" || resolvedAlias === "nano_banner") && isHttpUrl(input.referenceImage)) {
      bodyPayload.reference_image_url = input.referenceImage;
    }
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`图像生成失败: ${response.status} ${rawText}`);
    }

    const parsed = JSON.parse(rawText) as {
      data?: Array<{ url?: string; image_url?: string; b64_json?: string }>;
    };
    const first = parsed.data?.[0];
    const urlFromOpenAI = typeof first?.url === "string" ? first.url.trim() : "";
    const urlFromAceData = typeof first?.image_url === "string" ? first.image_url.trim() : "";
    const url = urlFromOpenAI || urlFromAceData;
    const b64 = typeof first?.b64_json === "string" ? first.b64_json.trim() : "";

    if (url) return url;
    if (b64) return toDataUrl(b64);
    throw new Error("图像生成失败：未返回可用图片数据。");
  } finally {
    clearTimeout(timeout);
  }
}

