import type { QuickDirection, QuickPath, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

export type QuickPathContext = {
  idea: string;
  direction: QuickDirection | "";
  style: QuickStyle | "";
  scale: QuickScalePreference | "";
  referenceImage: string;
  quickJudgement: string;
  quickPath: QuickPath | "";
};

export function readQuickPathContext(rawSearch: string): QuickPathContext {
  const search = new URLSearchParams(rawSearch);
  const directionValue = search.get("direction");
  const styleValue = search.get("style");
  const scaleValue = search.get("scale");
  const quickPathValue = search.get("quickPath");

  const direction: QuickDirection | "" =
    directionValue === "display" || directionValue === "cost" || directionValue === "production" ? directionValue : "";
  const style: QuickStyle | "" =
    styleValue === "cute" || styleValue === "mechanical" || styleValue === "realistic" || styleValue === "fantasy"
      ? styleValue
      : "";
  const scale: QuickScalePreference | "" =
    scaleValue === "small" || scaleValue === "medium" || scaleValue === "large" ? scaleValue : "";
  const quickPath: QuickPath | "" =
    quickPathValue === "small_batch" || quickPathValue === "creator_plan" || quickPathValue === "professional_upgrade"
      ? quickPathValue
      : "";

  return {
    idea: search.get("idea")?.trim() ?? "",
    direction,
    style,
    scale,
    referenceImage: search.get("referenceImage")?.trim() ?? "",
    quickJudgement: search.get("quickJudgement")?.trim() ?? "",
    quickPath
  };
}

export function buildQuickPathHref(path: "small_batch" | "creator_plan" | "professional_upgrade", context: QuickPathContext) {
  const params = new URLSearchParams();
  if (context.idea) params.set("idea", context.idea);
  if (context.direction) params.set("direction", context.direction);
  if (context.style) params.set("style", context.style);
  if (context.scale) params.set("scale", context.scale);
  if (context.referenceImage) params.set("referenceImage", context.referenceImage);
  if (context.quickJudgement) params.set("quickJudgement", context.quickJudgement);
  params.set("quickPath", path);

  if (path === "small_batch") return `/quick/path/small-batch?${params.toString()}`;
  if (path === "creator_plan") return `/quick/path/creator-plan?${params.toString()}`;
  return `/quick/path/professional-upgrade?${params.toString()}`;
}

export function buildProfessionalProjectNewHref(context: QuickPathContext) {
  const params = new URLSearchParams();
  params.set("from", "quick");
  if (context.idea) params.set("idea", context.idea);
  if (context.direction) params.set("direction", context.direction);
  if (context.style) params.set("style", context.style);
  if (context.scale) params.set("scale", context.scale);
  if (context.quickJudgement) params.set("quickJudgement", context.quickJudgement);
  params.set("quickPath", "professional_upgrade");
  return `/projects/new?${params.toString()}`;
}

export function buildQuickResultHref(context: QuickPathContext) {
  const params = new URLSearchParams();
  if (context.idea) params.set("idea", context.idea);
  if (context.direction) params.set("direction", context.direction);
  if (context.style) params.set("style", context.style);
  if (context.scale) params.set("scale", context.scale);
  if (context.referenceImage) params.set("referenceImage", context.referenceImage);
  return `/quick/result?${params.toString()}`;
}

