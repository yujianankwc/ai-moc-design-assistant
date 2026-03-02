export const QUICK_DIRECTION_OPTIONS = ["display", "cost", "production"] as const;
export type QuickDirection = (typeof QUICK_DIRECTION_OPTIONS)[number];

export const QUICK_STYLE_OPTIONS = ["cute", "mechanical", "realistic", "fantasy"] as const;
export type QuickStyle = (typeof QUICK_STYLE_OPTIONS)[number];

export const QUICK_SCALE_OPTIONS = ["small", "medium", "large"] as const;
export type QuickScalePreference = (typeof QUICK_SCALE_OPTIONS)[number];

export type QuickPath = "small_batch" | "creator_plan" | "professional_upgrade";

export type QuickEntryInput = {
  idea: string;
  direction: QuickDirection | "";
  style: QuickStyle | "";
  scale: QuickScalePreference | "";
  referenceImage: string;
  correctionIntent?: string;
};

export type QuickEntryResult = {
  topJudgement: string;
  conceptTitle: string;
  conceptPreview: string;
  recommendedFit: string;
  recommendedReason: string;
  suggestedPath: QuickPath;
};

