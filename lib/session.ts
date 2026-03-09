export const SESSION_COOKIE_NAME = "moc_invite_session_v1";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const runtimeSessionSecret = crypto.randomUUID();

function getSessionSecret() {
  return (process.env.MOC_SESSION_SECRET || process.env.INVITE_CODES || runtimeSessionSecret).trim();
}

export function shouldUseSecureCookies(requestUrl?: string) {
  if (process.env.NODE_ENV !== "production") return false;
  if (!requestUrl) return true;
  try {
    const url = new URL(requestUrl);
    return url.hostname !== "127.0.0.1" && url.hostname !== "localhost";
  } catch {
    return true;
  }
}

function uint8ArrayToHex(value: Uint8Array) {
  return Array.from(value)
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(payload: string) {
  const secret = getSessionSecret();
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

export async function createInviteSessionToken() {
  const issuedAt = Date.now().toString(36);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const payload = `${issuedAt}.${nonce}`;
  const signature = await signPayload(payload);
  if (!signature) {
    throw new Error("当前缺少会话签名配置，无法创建登录会话。");
  }
  return `${payload}.${signature}`;
}

export async function verifyInviteSessionToken(value: string | null | undefined) {
  const token = (value || "").trim();
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = await signPayload(payload);
  if (!expected) return false;
  return expected === parts[2];
}
