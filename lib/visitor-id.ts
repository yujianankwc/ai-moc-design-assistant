export const VISITOR_COOKIE_NAME = "moc_visitor_id";
export const VISITOR_HEADER_NAME = "x-moc-visitor-id";

export function normalizeVisitorId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

export function buildScopedDemoUser(visitorId: string) {
  const safeVisitorId = normalizeVisitorId(visitorId) || "anonymous";
  return {
    id: `demo-user-${safeVisitorId}`,
    email: `demo+${safeVisitorId}@aimoc.local`,
    name: "MVP Demo User"
  } as const;
}
