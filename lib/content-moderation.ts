import type {
  QuickEntryInput,
  QuickEntryResult,
  QuickImageModerationStatus,
  QuickModerationMeta,
  QuickModerationReason,
  QuickModerationStatus,
  QuickPublishEligibility
} from "@/types/quick-entry";

type ModerationDecision = {
  status: QuickModerationStatus;
  reason: QuickModerationReason | "";
  publicMessage: string;
};

type PublishReviewDecision = QuickModerationMeta & {
  publicMessage: string;
};

const TEXT_BLOCK_PATTERNS: Array<{ reason: QuickModerationReason; patterns: RegExp[] }> = [
  {
    reason: "minor_risk",
    patterns: [
      /(未成年|幼女|幼童|萝莉|学生妹|小女孩|小男孩).{0,8}(裸体|裸露|情色|性爱|做爱|性奴|调教)/i,
      /(性侵|强奸|迷奸|乱伦|幼交|炼铜)/i
    ]
  },
  {
    reason: "explicit_nudity",
    patterns: [
      /(全裸|裸照|裸露|爆乳|巨乳|乳沟|下体|阴部|私处|丁字裤|露点|透明内衣|情趣内衣)/i
    ]
  },
  {
    reason: "sexual_content",
    patterns: [
      /(做爱|性交|约炮|色情网|成人视频|成人视频|成人影片|春宫|AV片|av\b|porn|nsfw|情色|色情|自慰|开房)/i,
      /(SM|调教|捆绑|情趣玩具|性玩具|媚药)/i
    ]
  },
  {
    reason: "policy_blocked_publish",
    patterns: [/(嫖娼|招嫖|卖淫|毒品|制毒|炸药|枪支交易|假币|诈骗话术|洗钱)/i]
  }
];

const IMAGE_SAFETY_PATTERNS = /(content policy|safety|unsafe|nsfw|sexual|nudity|裸体|裸露|色情)/i;

const BLOCK_GENERATION_MESSAGE = "这条内容不适合生成，请换个方向试试。";
const PRIVATE_DRAFT_MESSAGE = "这条内容已先保存为仅自己可见，暂时不能公开展示。";

function normalizeText(value: string | null | undefined) {
  return (value || "").trim();
}

function combineTexts(values: Array<string | null | undefined>) {
  return values.map((item) => normalizeText(item)).filter(Boolean).join("\n");
}

function decideByText(rawText: string): ModerationDecision {
  const text = normalizeText(rawText);
  if (!text) {
    return {
      status: "allow",
      reason: "",
      publicMessage: ""
    };
  }

  for (const rule of TEXT_BLOCK_PATTERNS) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        status: "block",
        reason: rule.reason,
        publicMessage: BLOCK_GENERATION_MESSAGE
      };
    }
  }

  return {
    status: "allow",
    reason: "",
    publicMessage: ""
  };
}

export function moderateQuickGenerationInput(input: QuickEntryInput): ModerationDecision {
  return decideByText(
    combineTexts([input.idea, input.correctionIntent, input.referenceImage])
  );
}

export function moderateQuickGeneratedCopy(input: {
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
}): ModerationDecision {
  return decideByText(
    combineTexts([
      input.quickInput.idea,
      input.quickInput.correctionIntent,
      input.quickResult.conceptTitle,
      input.quickResult.topJudgement,
      input.quickResult.conceptPreview,
      input.quickResult.recommendedReason
    ])
  );
}

function inferImageReviewStatus(input: {
  previewImageUrl: string | null;
  imageWarning?: string;
  imageLastError?: string;
  textReview: ModerationDecision;
}): {
  imageModerationStatus: QuickImageModerationStatus;
  reason: QuickModerationReason | "";
  publicMessage: string;
} {
  const warningText = combineTexts([input.imageWarning, input.imageLastError]);

  if (input.textReview.status === "block") {
    return {
      imageModerationStatus: "blocked",
      reason: input.textReview.reason,
      publicMessage: PRIVATE_DRAFT_MESSAGE
    };
  }

  if (!normalizeText(input.previewImageUrl)) {
    return {
      imageModerationStatus: "blocked",
      reason: "image_required_for_public_publish",
      publicMessage: PRIVATE_DRAFT_MESSAGE
    };
  }

  if (IMAGE_SAFETY_PATTERNS.test(warningText)) {
    return {
      imageModerationStatus: "blocked",
      reason: "image_upstream_safety_block",
      publicMessage: PRIVATE_DRAFT_MESSAGE
    };
  }

  return {
    imageModerationStatus: "approved",
    reason: "",
    publicMessage: ""
  };
}

export function buildBlockedModerationMeta(reason: QuickModerationReason, at = new Date().toISOString()): QuickModerationMeta {
  return {
    moderationStatus: "block",
    moderationReason: reason,
    publishEligibility: "private_draft",
    imageModerationStatus: "blocked",
    lastModeratedAt: at,
    publishAttemptedAt: null
  };
}

export function buildAllowedModerationMeta(at = new Date().toISOString()): QuickModerationMeta {
  return {
    moderationStatus: "allow",
    moderationReason: "",
    publishEligibility: "private_draft",
    imageModerationStatus: "pending",
    lastModeratedAt: at,
    publishAttemptedAt: null
  };
}

export function reviewQuickProjectForPublicPublish(input: {
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  previewImageUrl: string | null;
  imageWarning?: string;
  imageLastError?: string;
  previous?: Partial<QuickModerationMeta>;
  publishAttemptedAt?: string | null;
}): PublishReviewDecision {
  const textReview = moderateQuickGeneratedCopy({
    quickInput: input.quickInput,
    quickResult: input.quickResult
  });
  const imageReview = inferImageReviewStatus({
    previewImageUrl: input.previewImageUrl,
    imageWarning: input.imageWarning,
    imageLastError: input.imageLastError,
    textReview
  });
  const now = new Date().toISOString();
  const publishEligibility: QuickPublishEligibility =
    textReview.status === "allow" && imageReview.imageModerationStatus === "approved"
      ? "public"
      : "private_draft";

  return {
    moderationStatus: textReview.status,
    moderationReason: imageReview.reason || textReview.reason,
    publishEligibility,
    imageModerationStatus: imageReview.imageModerationStatus,
    lastModeratedAt: now,
    publishAttemptedAt:
      input.publishAttemptedAt === undefined
        ? input.previous?.publishAttemptedAt ?? null
        : input.publishAttemptedAt,
    publicMessage:
      publishEligibility === "public"
        ? ""
        : imageReview.publicMessage || PRIVATE_DRAFT_MESSAGE
  };
}

export function isQuickProjectPubliclyVisible(meta: Partial<QuickModerationMeta> | null | undefined) {
  return meta?.publishEligibility === "public" && meta?.imageModerationStatus === "approved";
}

export function getBlockedGenerationMessage() {
  return BLOCK_GENERATION_MESSAGE;
}

export function getPrivateDraftMessage() {
  return PRIVATE_DRAFT_MESSAGE;
}
