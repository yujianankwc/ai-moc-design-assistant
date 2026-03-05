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

type UpstreamIds = {
  traceId?: string;
  requestId?: string;
  logId?: string;
};

export class ImageGenerationUpstreamError extends Error {
  status: number;
  alias: QuickImageAlias;
  rawText: string;
  traceId?: string;
  requestId?: string;
  logId?: string;

  constructor(input: {
    message: string;
    status: number;
    alias: QuickImageAlias;
    rawText: string;
    traceId?: string;
    requestId?: string;
    logId?: string;
  }) {
    super(input.message);
    this.name = "ImageGenerationUpstreamError";
    this.status = input.status;
    this.alias = input.alias;
    this.rawText = input.rawText;
    this.traceId = input.traceId;
    this.requestId = input.requestId;
    this.logId = input.logId;
  }
}

export function isImageGenerationUpstreamError(error: unknown): error is ImageGenerationUpstreamError {
  return error instanceof ImageGenerationUpstreamError;
}

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

function pickNestedId(value: unknown, keys: string[]) {
  const queue: unknown[] = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    for (const [rawKey, rawValue] of Object.entries(record)) {
      const normalized = rawKey.toLowerCase().replace(/[-\s]/g, "_");
      if (keys.includes(normalized) && typeof rawValue === "string" && rawValue.trim()) {
        return rawValue.trim();
      }
      if (rawValue && typeof rawValue === "object") {
        queue.push(rawValue);
      }
    }
  }
  return "";
}

function extractIdsFromRawText(rawText: string): UpstreamIds {
  const result: UpstreamIds = {};
  try {
    const parsed = JSON.parse(rawText) as unknown;
    result.traceId = pickNestedId(parsed, ["trace_id", "traceid"]) || undefined;
    result.requestId = pickNestedId(parsed, ["request_id", "requestid", "req_id"]) || undefined;
    result.logId = pickNestedId(parsed, ["log_id", "logid"]) || undefined;
    return result;
  } catch {
    const traceMatch = rawText.match(/"trace[_-]?id"\s*:\s*"([^"]+)"/i);
    const requestMatch = rawText.match(/"(request[_-]?id|req[_-]?id)"\s*:\s*"([^"]+)"/i);
    const logMatch = rawText.match(/"log[_-]?id"\s*:\s*"([^"]+)"/i);
    return {
      traceId: traceMatch?.[1],
      requestId: requestMatch?.[2],
      logId: logMatch?.[1]
    };
  }
}

function buildRequestBody(
  resolvedAlias: QuickImageAlias,
  imageModel: string,
  imageSize: string,
  prompt: string,
  referenceImage?: string
): Record<string, unknown> {
  const bodyPayload: Record<string, unknown> = {
    model: imageModel,
    prompt,
    size: imageSize,
    response_format: "url"
  };
  if (resolvedAlias === "nano_banana" || resolvedAlias === "nano_banner") {
    bodyPayload.sequential_image_generation = "disabled";
    bodyPayload.stream = false;
    bodyPayload.watermark = true;
    if (isHttpUrl(referenceImage)) {
      bodyPayload.reference_image_url = referenceImage;
    }
  } else if (resolvedAlias === "default" && isHttpUrl(referenceImage)) {
    bodyPayload.image = referenceImage;
    bodyPayload.sequential_image_generation = "disabled";
    bodyPayload.stream = false;
    bodyPayload.watermark = true;
  }
  return bodyPayload;
}

function extractUpstreamError(response: Response, rawText: string, resolvedAlias: QuickImageAlias) {
  const idsFromBody = extractIdsFromRawText(rawText);
  const traceId = idsFromBody.traceId || response.headers.get("x-trace-id") || response.headers.get("trace-id") || undefined;
  const requestId =
    idsFromBody.requestId ||
    response.headers.get("x-request-id") ||
    response.headers.get("request-id") ||
    response.headers.get("x-req-id") ||
    undefined;
  const logId =
    idsFromBody.logId ||
    response.headers.get("x-tt-logid") ||
    response.headers.get("x-log-id") ||
    response.headers.get("log-id") ||
    undefined;
  return new ImageGenerationUpstreamError({
    message: `图像生成失败: ${response.status} ${rawText}`,
    status: response.status,
    alias: resolvedAlias,
    rawText,
    traceId,
    requestId,
    logId
  });
}

function parseImageResult(rawText: string): string {
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
}

async function doImageRequest(
  requestUrl: string,
  apiKey: string,
  bodyPayload: Record<string, unknown>,
  resolvedAlias: QuickImageAlias,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
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
      throw extractUpstreamError(response, rawText, resolvedAlias);
    }
    return parseImageResult(rawText);
  } finally {
    clearTimeout(timer);
  }
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

  const prompt = `${buildImagePromptFromSummary(input)}${
    input.regenerateToken ? `\n构图变化标识：${input.regenerateToken}` : ""
  }`;

  const hasRef = isHttpUrl(input.referenceImage);
  const bodyPayload = buildRequestBody(resolvedAlias, imageModel, imageSize, prompt, input.referenceImage);

  try {
    return await doImageRequest(requestUrl, apiKey, bodyPayload, resolvedAlias, timeoutMs);
  } catch (firstError) {
    if (hasRef && resolvedAlias === "default") {
      console.warn(
        `[ai-quick-image] default model with reference image failed, retrying without reference image. error=${
          firstError instanceof Error ? firstError.message : String(firstError)
        }`
      );
      const fallbackBody = buildRequestBody(resolvedAlias, imageModel, imageSize, prompt, undefined);
      return await doImageRequest(requestUrl, apiKey, fallbackBody, resolvedAlias, timeoutMs);
    }
    throw firstError;
  }
}

