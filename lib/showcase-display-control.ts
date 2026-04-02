export type ShowcaseDisplayControl = {
  featured: boolean;
  homepage: boolean;
  paused: boolean;
};

const DEFAULT_CONTROL: ShowcaseDisplayControl = {
  featured: false,
  homepage: false,
  paused: false
};

const CONTROL_MARKER = "[SHOWCASE_CONTROL]";

export function parseShowcaseDisplayControl(operatorNote: string | null | undefined): ShowcaseDisplayControl {
  const value = operatorNote || "";
  const line = value
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith(CONTROL_MARKER));

  if (!line) return DEFAULT_CONTROL;

  try {
    const raw = JSON.parse(line.slice(CONTROL_MARKER.length));
    return {
      featured: Boolean(raw?.featured),
      homepage: Boolean(raw?.homepage),
      paused: Boolean(raw?.paused)
    };
  } catch {
    return DEFAULT_CONTROL;
  }
}

export function upsertShowcaseDisplayControl(
  operatorNote: string | null | undefined,
  control: ShowcaseDisplayControl
) {
  const lines = (operatorNote || "")
    .split("\n")
    .filter((item) => item.trim() && !item.trim().startsWith(CONTROL_MARKER));
  lines.push(`${CONTROL_MARKER}${JSON.stringify(control)}`);
  return lines.join("\n");
}

export function formatShowcaseDisplayControl(control: ShowcaseDisplayControl) {
  const labels: string[] = [];
  if (control.featured) labels.push("精选展示");
  if (control.homepage) labels.push("首页优先");
  if (control.paused) labels.push("暂停公开展示");
  return labels.length > 0 ? labels.join(" · ") : "按默认公开展示";
}
