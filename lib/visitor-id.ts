export const VISITOR_COOKIE_NAME = "moc_visitor_id";
export const VISITOR_HEADER_NAME = "x-moc-visitor-id";

const runtimeVisitorSecret = crypto.randomUUID();

export function normalizeVisitorId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

function getVisitorSecret() {
  return (process.env.MOC_VISITOR_SECRET || process.env.MOC_SESSION_SECRET || process.env.INVITE_CODES || runtimeVisitorSecret).trim();
}

function uint8ArrayToHex(value: Uint8Array) {
  return Array.from(value)
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(payload: string) {
  const secret = getVisitorSecret();
  if (!secret) return "";

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return uint8ArrayToHex(new Uint8Array(signature));
}

export async function createVisitorToken(visitorId: string) {
  const safeVisitorId = normalizeVisitorId(visitorId);
  if (!safeVisitorId) {
    throw new Error("无法创建访客会话。");
  }
  const signature = await signPayload(safeVisitorId);
  if (!signature) {
    throw new Error("当前缺少访客会话签名配置，无法继续。");
  }
  return `${safeVisitorId}.${signature}`;
}

export async function resolveVisitorIdFromToken(value: string | null | undefined) {
  const token = (value || "").trim();
  if (!token) return "";
  const parts = token.split(".");
  if (parts.length !== 2) return "";

  const visitorId = normalizeVisitorId(parts[0]);
  if (!visitorId) return "";

  const expected = await signPayload(visitorId);
  if (!expected || expected !== parts[1]) return "";
  return visitorId;
}

export function buildScopedDemoUser(visitorId: string) {
  const safeVisitorId = normalizeVisitorId(visitorId) || "anonymous";
  return {
    id: `demo-user-${safeVisitorId}`,
    email: `demo+${safeVisitorId}@aimoc.local`,
    name: "MVP Demo User"
  } as const;
}
