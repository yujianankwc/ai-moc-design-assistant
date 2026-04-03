export const QUICK_DIRECTION_OPTIONS = ["display", "cost", "production"] as const;
export type QuickDirection = (typeof QUICK_DIRECTION_OPTIONS)[number];

export const QUICK_STYLE_OPTIONS = ["cute", "mechanical", "realistic", "fantasy"] as const;
export type QuickStyle = (typeof QUICK_STYLE_OPTIONS)[number];

export const QUICK_SCALE_OPTIONS = ["small", "medium", "large"] as const;
export type QuickScalePreference = (typeof QUICK_SCALE_OPTIONS)[number];

export type QuickPath = "small_batch" | "creator_plan" | "professional_upgrade";

export const QUICK_IMAGE_STATUS_OPTIONS = ["idle", "queued", "generating", "succeeded", "failed"] as const;
export type QuickImageStatus = (typeof QUICK_IMAGE_STATUS_OPTIONS)[number];

export const QUICK_IMAGE_MODEL_ALIAS_OPTIONS = ["default", "nano_banner", "nano_banana"] as const;
export type QuickImageModelAlias = (typeof QUICK_IMAGE_MODEL_ALIAS_OPTIONS)[number];

export const QUICK_MODERATION_STATUS_OPTIONS = ["allow", "block"] as const;
export type QuickModerationStatus = (typeof QUICK_MODERATION_STATUS_OPTIONS)[number];

export const QUICK_PUBLISH_ELIGIBILITY_OPTIONS = ["public", "private_draft"] as const;
export type QuickPublishEligibility = (typeof QUICK_PUBLISH_ELIGIBILITY_OPTIONS)[number];

export const QUICK_IMAGE_MODERATION_STATUS_OPTIONS = ["pending", "approved", "blocked"] as const;
export type QuickImageModerationStatus = (typeof QUICK_IMAGE_MODERATION_STATUS_OPTIONS)[number];

export const QUICK_MODERATION_REASON_OPTIONS = [
  "sexual_content",
  "minor_risk",
  "explicit_nudity",
  "unsafe_reference_image",
  "policy_blocked_publish",
  "image_required_for_public_publish",
  "image_review_unavailable",
  "image_upstream_safety_block"
] as const;
export type QuickModerationReason = (typeof QUICK_MODERATION_REASON_OPTIONS)[number];

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

export type QuickModerationMeta = {
  moderationStatus: QuickModerationStatus;
  moderationReason: QuickModerationReason | "";
  publishEligibility: QuickPublishEligibility;
  imageModerationStatus: QuickImageModerationStatus;
  lastModeratedAt: string | null;
  publishAttemptedAt?: string | null;
};
