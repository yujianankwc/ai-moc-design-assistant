function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function getInviteCodesFromEnv() {
  const raw = process.env.INVITE_CODES || "";
  return raw
    .split(",")
    .map((item) => normalizeInviteCode(item))
    .filter(Boolean);
}

export function isValidInviteCode(input: string) {
  const code = normalizeInviteCode(input);
  if (!code) return false;
  const codes = getInviteCodesFromEnv();
  return codes.includes(code);
}

