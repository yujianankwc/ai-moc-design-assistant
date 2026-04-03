import { cookies, headers } from "next/headers";
import { buildEditableVersion } from "@/lib/editable-version";
import {
  buildAllowedModerationMeta,
  buildBlockedModerationMeta,
  isQuickProjectPubliclyVisible as isQuickProjectPubliclyVisibleByMeta,
  reviewQuickProjectForPublicPublish
} from "@/lib/content-moderation";
import { mapProjectCategoryToShowcaseCategory } from "@/lib/showcase-category";
import { evaluateProductionScoreByRules } from "@/lib/production-score-rules";
import {
  formatShowcaseDisplayControl,
  parseShowcaseDisplayControl,
  upsertShowcaseDisplayControl,
  type ShowcaseDisplayControl
} from "@/lib/showcase-display-control";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildScopedDemoUser,
  normalizeVisitorId,
  resolveVisitorIdFromToken,
  VISITOR_COOKIE_NAME,
  VISITOR_HEADER_NAME
} from "@/lib/visitor-id";
import { mockProjectResults } from "@/services/mock-project-results";
import { generateProjectOutputWithAI } from "@/services/ai-project-output";
import type { GenerationMode } from "@/types/generation-mode";
import type { ProjectDetailRow, ProjectFormPayload, ProjectRow, ProjectStatus } from "@/types/project";
import type { ProjectOutputRow } from "@/types/project-output";
import type {
  QuickEntryInput,
  QuickEntryResult,
  QuickImageModerationStatus,
  QuickImageModelAlias,
  QuickImageStatus,
  QuickModerationReason,
  QuickModerationStatus,
  QuickPublishEligibility
} from "@/types/quick-entry";
import type {
  CreateIntentInput,
  CreateQuoteInput,
  IntentSourceType,
  IntentStatus,
  QuoteStatus
} from "@/types/intent";
import type {
  CreateServiceRequestInput,
  ServiceRequestRow,
  ServiceRequestStatus
} from "@/types/service-request";

export const SYSTEM_FALLBACK_MARKER = "__SYSTEM_FALLBACK__:";
export const RULE_DEDUCTION_MARKER = "__RULE_DEDUCTIONS__:";
export const QUICK_PROJECT_DATA_MARKER = "__QUICK_PROJECT_DATA__:";

export type ShowcaseInteractionAction = "like" | "watch";

export function quickProjectHasImage(notesForFactory: string | null | undefined): boolean {
  return Boolean(getQuickProjectPreviewImageUrl(notesForFactory));
}

export function getQuickProjectPreviewImageUrl(notesForFactory: string | null | undefined): string | null {
  return getQuickProjectImageMeta(notesForFactory).previewImageUrl;
}

export function getQuickProjectImageMeta(notesForFactory: string | null | undefined): QuickProjectImageMeta {
  if (!notesForFactory || !notesForFactory.startsWith(QUICK_PROJECT_DATA_MARKER)) {
    return buildDefaultQuickProjectImageMeta();
  }
  try {
    const json = notesForFactory.slice(QUICK_PROJECT_DATA_MARKER.length);
    const parsed = normalizeQuickProjectData(JSON.parse(json) as QuickProjectData);
    return {
      previewImageUrl: parsed.previewImageUrl ?? null,
      imageWarning: parsed.imageWarning ?? "",
      imageStatus: parsed.imageStatus ?? "idle",
      imageUpdatedAt: parsed.imageUpdatedAt ?? null,
      imageLastError: parsed.imageLastError ?? "",
      imageAttemptCount: parsed.imageAttemptCount ?? 0,
      imageModelAlias: parsed.imageModelAlias ?? null
    };
  } catch {
    return buildDefaultQuickProjectImageMeta();
  }
}

export function getQuickProjectModerationMeta(notesForFactory: string | null | undefined): QuickProjectModerationMeta {
  if (!notesForFactory || !notesForFactory.startsWith(QUICK_PROJECT_DATA_MARKER)) {
    return buildDefaultQuickProjectModerationMeta();
  }
  try {
    const json = notesForFactory.slice(QUICK_PROJECT_DATA_MARKER.length);
    const raw = JSON.parse(json) as QuickProjectData;
    const parsed = normalizeQuickProjectData(raw);
    const isLegacyRecord =
      !Object.prototype.hasOwnProperty.call(raw, "moderationStatus") &&
      !Object.prototype.hasOwnProperty.call(raw, "publishEligibility") &&
      !Object.prototype.hasOwnProperty.call(raw, "imageModerationStatus");

    if (isLegacyRecord && parsed.previewImageUrl) {
      return {
        moderationStatus: "allow",
        moderationReason: "",
        publishEligibility: "public",
        imageModerationStatus: "approved",
        lastModeratedAt: null,
        publishAttemptedAt: null
      };
    }

    return {
      moderationStatus: parsed.moderationStatus ?? "allow",
      moderationReason: parsed.moderationReason ?? "",
      publishEligibility: parsed.publishEligibility ?? "private_draft",
      imageModerationStatus: parsed.imageModerationStatus ?? "pending",
      lastModeratedAt: parsed.lastModeratedAt ?? null,
      publishAttemptedAt: parsed.publishAttemptedAt ?? null
    };
  } catch {
    return buildDefaultQuickProjectModerationMeta();
  }
}

export function isQuickProjectPubliclyVisible(notesForFactory: string | null | undefined): boolean {
  return isQuickProjectPubliclyVisibleByMeta(getQuickProjectModerationMeta(notesForFactory));
}

type QuickProjectData = {
  input: QuickEntryInput;
  result: QuickEntryResult;
  textWarning?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
  imageStatus?: QuickImageStatus;
  imageUpdatedAt?: string | null;
  imageLastError?: string;
  imageAttemptCount?: number;
  imageModelAlias?: QuickImageModelAlias | null;
  moderationStatus?: QuickModerationStatus;
  moderationReason?: QuickModerationReason | "";
  publishEligibility?: QuickPublishEligibility;
  imageModerationStatus?: QuickImageModerationStatus;
  lastModeratedAt?: string | null;
  publishAttemptedAt?: string | null;
};

export type QuickProjectImageMeta = {
  previewImageUrl: string | null;
  imageWarning: string;
  imageStatus: QuickImageStatus;
  imageUpdatedAt: string | null;
  imageLastError: string;
  imageAttemptCount: number;
  imageModelAlias: QuickImageModelAlias | null;
};

export type QuickProjectModerationMeta = {
  moderationStatus: QuickModerationStatus;
  moderationReason: QuickModerationReason | "";
  publishEligibility: QuickPublishEligibility;
  imageModerationStatus: QuickImageModerationStatus;
  lastModeratedAt: string | null;
  publishAttemptedAt: string | null;
};

function buildDefaultQuickProjectImageMeta(): QuickProjectImageMeta {
  return {
    previewImageUrl: null,
    imageWarning: "",
    imageStatus: "idle",
    imageUpdatedAt: null,
    imageLastError: "",
    imageAttemptCount: 0,
    imageModelAlias: null
  };
}

function buildDefaultQuickProjectModerationMeta(): QuickProjectModerationMeta {
  const base = buildAllowedModerationMeta();
  return {
    moderationStatus: base.moderationStatus,
    moderationReason: base.moderationReason,
    publishEligibility: base.publishEligibility,
    imageModerationStatus: base.imageModerationStatus,
    lastModeratedAt: base.lastModeratedAt,
    publishAttemptedAt: base.publishAttemptedAt ?? null
  };
}

function normalizeQuickImageStatus(value: unknown, fallback: QuickImageStatus): QuickImageStatus {
  return value === "idle" ||
    value === "queued" ||
    value === "generating" ||
    value === "succeeded" ||
    value === "failed"
    ? value
    : fallback;
}

function normalizeQuickImageModelAlias(value: unknown): QuickImageModelAlias | null {
  return value === "default" || value === "nano_banner" || value === "nano_banana" ? value : null;
}

function normalizeQuickModerationStatus(value: unknown): QuickModerationStatus {
  return value === "block" ? "block" : "allow";
}

function normalizeQuickPublishEligibility(value: unknown): QuickPublishEligibility {
  return value === "public" ? "public" : "private_draft";
}

function normalizeQuickImageModerationStatus(value: unknown): QuickImageModerationStatus {
  return value === "approved" || value === "blocked" ? value : "pending";
}

function normalizeQuickModerationReason(value: unknown): QuickModerationReason | "" {
  return typeof value === "string" ? (value as QuickModerationReason | "") : "";
}

function normalizeQuickProjectData(input: QuickProjectData): QuickProjectData {
  const previewImageUrl =
    typeof input.previewImageUrl === "string" && input.previewImageUrl.trim()
      ? input.previewImageUrl.trim()
      : null;
  const imageWarning = typeof input.imageWarning === "string" ? input.imageWarning : "";
  const inferredStatus = previewImageUrl ? "succeeded" : imageWarning ? "failed" : "idle";
  const imageStatus = normalizeQuickImageStatus(input.imageStatus, inferredStatus);
  const imageLastError =
    typeof input.imageLastError === "string"
      ? input.imageLastError
      : imageStatus === "failed"
        ? imageWarning
        : "";
  const moderationStatus = normalizeQuickModerationStatus(input.moderationStatus);
  const publishEligibility = normalizeQuickPublishEligibility(input.publishEligibility);
  const imageModerationStatus = normalizeQuickImageModerationStatus(input.imageModerationStatus);
  const moderationReason = normalizeQuickModerationReason(input.moderationReason);
  return {
    ...input,
    previewImageUrl,
    imageWarning: imageStatus === "failed" ? imageWarning || imageLastError : "",
    imageStatus,
    imageUpdatedAt: typeof input.imageUpdatedAt === "string" ? input.imageUpdatedAt : null,
    imageLastError: imageStatus === "failed" ? imageLastError : "",
    imageAttemptCount: typeof input.imageAttemptCount === "number" ? input.imageAttemptCount : 0,
    imageModelAlias: normalizeQuickImageModelAlias(input.imageModelAlias),
    moderationStatus,
    moderationReason: moderationStatus === "block" ? moderationReason : "",
    publishEligibility,
    imageModerationStatus,
    lastModeratedAt: typeof input.lastModeratedAt === "string" ? input.lastModeratedAt : null,
    publishAttemptedAt: typeof input.publishAttemptedAt === "string" ? input.publishAttemptedAt : null
  };
}

function clampChars(value: string, maxChars: number) {
  const chars = Array.from(value.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars).join("")}…`;
}

function stripTitlePrefixes(value: string) {
  return value
    .replace(/^(做一个|想做一个|试试做个|做成|来一个|做个|试试做一个|想做个)\s*/g, "")
    .trim();
}

function stripProcessWords(value: string) {
  return value
    .replace(/(低成本|众筹|打样|验证|方案|路线|试水|可量产|升级专业|方向判断)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pickCoreTheme(value: string) {
  const cleaned = stripProcessWords(stripTitlePrefixes(value));
  const compact = cleaned.replace(/\s+/g, " ").trim();
  if (!compact) return "创意主题";
  const byPunctuation = compact.split(/[，。,.!！?？:：;；、\n]/).map((item) => item.trim()).filter(Boolean);
  const firstChunk = byPunctuation[0] || compact;
  return clampChars(firstChunk, 12).replace(/[（）()]/g, "").trim() || "创意主题";
}

function normalizeQuickProjectTitle(input: {
  conceptTitle?: string | null;
  rawIdea?: string | null;
}) {
  const concept = (input.conceptTitle ?? "")
    .replace(/（AI\s*轻量概念）/g, "")
    .replace(/（轻量概念版）/g, "")
    .trim();
  const raw = (input.rawIdea ?? "").trim();
  const picked = concept || raw || "创意主题";
  const coreTheme = pickCoreTheme(picked);
  const normalized = `${coreTheme}（AI 轻量概念）`;
  return clampChars(normalized, 22);
}

function encodeQuickProjectData(data: QuickProjectData) {
  return `${QUICK_PROJECT_DATA_MARKER}${JSON.stringify(data)}`;
}

function decodeQuickProjectData(raw: string | null | undefined): QuickProjectData | null {
  if (!raw || !raw.startsWith(QUICK_PROJECT_DATA_MARKER)) return null;
  try {
    const json = raw.slice(QUICK_PROJECT_DATA_MARKER.length);
    const parsed = JSON.parse(json) as QuickProjectData;
    if (!parsed?.input?.idea || !parsed?.result?.topJudgement) return null;
    return normalizeQuickProjectData(parsed);
  } catch {
    return null;
  }
}

export async function ensureCurrentVisitorUser() {
  const supabase = getSupabaseServerClient();
  const headerStore = await headers();
  const cookieStore = await cookies();
  const headerVisitorId = normalizeVisitorId(headerStore.get(VISITOR_HEADER_NAME) ?? "");
  const cookieVisitorId = await resolveVisitorIdFromToken(cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "");
  const visitorId = headerVisitorId || cookieVisitorId;
  if (!visitorId) {
    throw new Error("访客会话无效，请刷新页面后重试。");
  }
  const currentVisitorUser = buildScopedDemoUser(visitorId);

  const { error } = await supabase.from("users").upsert(
    {
      id: currentVisitorUser.id,
      email: currentVisitorUser.email,
      name: currentVisitorUser.name
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`演示用户初始化失败: ${error.message}`);
  }

  return currentVisitorUser;
}

export async function ensureDemoUser() {
  return ensureCurrentVisitorUser();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveCurrentVisitorId() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const headerVisitorId = normalizeVisitorId(headerStore.get(VISITOR_HEADER_NAME) ?? "");
  const cookieVisitorId = await resolveVisitorIdFromToken(cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "");
  return headerVisitorId || cookieVisitorId;
}

function buildShowcaseInteractionTarget(showcaseKey: string) {
  const safeKey = showcaseKey.trim();
  if (!safeKey) {
    throw new Error("公开展示标识不能为空。");
  }
  return {
    showcaseKey: safeKey,
    projectId: isUuid(safeKey) ? safeKey : null
  };
}

export async function getShowcaseInteractionSummary(showcaseKey: string) {
  const supabase = getSupabaseServerClient();
  const visitorId = await resolveCurrentVisitorId();
  const target = buildShowcaseInteractionTarget(showcaseKey);

  const [
    { count: likeCount, error: likeError },
    { count: watchCount, error: watchError },
    { data: currentRows, error: currentError }
  ] = await Promise.all([
    supabase
      .from("showcase_interactions")
      .select("id", { count: "exact", head: true })
      .eq("showcase_key", target.showcaseKey)
      .eq("action_type", "like"),
    supabase
      .from("showcase_interactions")
      .select("id", { count: "exact", head: true })
      .eq("showcase_key", target.showcaseKey)
      .eq("action_type", "watch"),
    visitorId
      ? supabase
          .from("showcase_interactions")
          .select("action_type")
          .eq("showcase_key", target.showcaseKey)
          .eq("visitor_id", visitorId)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (likeError) throw new Error(`公开展示收藏数读取失败: ${likeError.message}`);
  if (watchError) throw new Error(`公开展示关注数读取失败: ${watchError.message}`);
  if (currentError) throw new Error(`公开展示互动状态读取失败: ${currentError.message}`);

  const actionSet = new Set((currentRows || []).map((item) => item.action_type));
  return {
    likes: likeCount || 0,
    watchers: watchCount || 0,
    liked: actionSet.has("like"),
    watching: actionSet.has("watch")
  };
}

export async function setShowcaseInteractionForVisitor(input: {
  showcaseKey: string;
  actionType: ShowcaseInteractionAction;
  active: boolean;
}) {
  const supabase = getSupabaseServerClient();
  const visitorId = await resolveCurrentVisitorId();
  if (!visitorId) {
    throw new Error("访客会话无效，请刷新页面后重试。");
  }

  const target = buildShowcaseInteractionTarget(input.showcaseKey);

  if (input.active) {
    const { error } = await supabase.from("showcase_interactions").upsert(
      {
        project_id: target.projectId,
        showcase_key: target.showcaseKey,
        visitor_id: visitorId,
        action_type: input.actionType
      },
      { onConflict: "showcase_key,visitor_id,action_type" }
    );
    if (error) {
      throw new Error(`公开展示互动写入失败: ${error.message}`);
    }
  } else {
    const { error } = await supabase
      .from("showcase_interactions")
      .delete()
      .eq("showcase_key", target.showcaseKey)
      .eq("visitor_id", visitorId)
      .eq("action_type", input.actionType);
    if (error) {
      throw new Error(`公开展示互动取消失败: ${error.message}`);
    }
  }

  return getShowcaseInteractionSummary(target.showcaseKey);
}

export async function getShowcaseInteractionStatsByProjectIds(projectIds: string[]) {
  const safeIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (safeIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("showcase_interactions")
    .select("project_id,action_type,created_at")
    .in("project_id", safeIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`公开展示互动统计读取失败: ${error.message}`);
  }

  const stats: Record<
    string,
    {
      likes: number;
      watchers: number;
      latestInteractionAt: string | null;
    }
  > = {};

  for (const projectId of safeIds) {
    stats[projectId] = {
      likes: 0,
      watchers: 0,
      latestInteractionAt: null
    };
  }

  for (const row of data || []) {
    if (!row.project_id || !stats[row.project_id]) continue;
    if (row.action_type === "like") stats[row.project_id].likes += 1;
    if (row.action_type === "watch") stats[row.project_id].watchers += 1;
    if (!stats[row.project_id].latestInteractionAt) {
      stats[row.project_id].latestInteractionAt = row.created_at;
    }
  }

  return stats;
}

export async function createProjectForCurrentVisitor(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: currentVisitorUser.id,
      status: input.status,
      ...input.payload
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`项目写入失败: ${error.message}`);
  }

  return data;
}

export async function createProjectForDemoUser(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  return createProjectForCurrentVisitor(input);
}

function normalizePayloadValue(value: string | null) {
  return value ?? "";
}

function projectRowToPayload(row: {
  title: string | null;
  category: string | null;
  style: string | null;
  size_target: string | null;
  size_note: string | null;
  audience: string | null;
  description: string | null;
  must_have_elements: string | null;
  avoid_elements: string | null;
  build_goal: string | null;
  collaboration_goal: string | null;
  willing_creator_plan: string | null;
  willing_sampling: string | null;
  reference_links: string | null;
  notes_for_factory: string | null;
}): ProjectFormPayload {
  return {
    title: normalizePayloadValue(row.title),
    category: normalizePayloadValue(row.category),
    style: normalizePayloadValue(row.style),
    size_target: normalizePayloadValue(row.size_target),
    size_note: normalizePayloadValue(row.size_note),
    audience: normalizePayloadValue(row.audience),
    description: normalizePayloadValue(row.description),
    must_have_elements: normalizePayloadValue(row.must_have_elements),
    avoid_elements: normalizePayloadValue(row.avoid_elements),
    build_goal: normalizePayloadValue(row.build_goal),
    collaboration_goal: normalizePayloadValue(row.collaboration_goal),
    willing_creator_plan: normalizePayloadValue(row.willing_creator_plan),
    willing_sampling: normalizePayloadValue(row.willing_sampling),
    reference_links: normalizePayloadValue(row.reference_links),
    notes_for_factory: normalizePayloadValue(row.notes_for_factory)
  };
}

function pickOutputTemplate(payload: ProjectFormPayload) {
  if (payload.category === "mechanism" || payload.style === "industrial") {
    return mockProjectResults[0];
  }
  if (payload.category === "scene" || payload.category === "vehicle") {
    return mockProjectResults[1];
  }
  return mockProjectResults[2];
}

async function createPlaceholderOutputForProject(input: {
  projectId: string;
  payload: ProjectFormPayload;
  fallbackReason: string;
  mode?: GenerationMode;
}) {
  const supabase = getSupabaseServerClient();
  const template = pickOutputTemplate(input.payload);
  const scored = evaluateProductionScoreByRules({
    payload: input.payload,
    bomGroups: template.bomDraft,
    riskNotes: template.risks.join("\n"),
    mode: input.mode
  });

  const highlightPoints = [
    `主题定位：${template.scenarioTag}`,
    `重点结构：${template.bomDraft[0]?.item ?? "核心结构待确认"}`,
    `推荐动作：${scored.recommendedService}`
  ];
  const productionHintWithRules = `${RULE_DEDUCTION_MARKER}${scored.keyDeductions.join("||")}\n${
    template.manufacturabilityTips[0] ?? ""
  }`.trim();

  const { error } = await supabase.from("project_outputs").upsert({
    project_id: input.projectId,
    design_summary: template.designBrief[0] ?? "",
    design_positioning: template.designBrief[1] ?? "",
    build_difficulty: template.production_score >= 75 ? "中等" : template.production_score >= 50 ? "中等偏高" : "较高",
    structure_notes: template.designBrief[2] ?? "",
    highlight_points: highlightPoints,
    bom_groups: template.bomDraft,
    substitution_suggestions: template.manufacturabilityTips.join("\n"),
    risk_notes: template.risks.join("\n"),
    production_hint: productionHintWithRules,
    production_score: scored.finalScore,
    recommended_next_step: scored.recommendedNextStep,
    internal_recommendation: `${SYSTEM_FALLBACK_MARKER}${input.fallbackReason}\n${template.collaborationAdvice.join(
      "\n"
    )}`,
    recommended_service: scored.recommendedService,
    editable_version: buildEditableVersion(template.manualEditDraft)
  }, { onConflict: "project_id" });

  if (error) {
    throw new Error(`项目结果写入失败: ${error.message}`);
  }
}

async function createAiOutputForProject(input: {
  projectId: string;
  payload: ProjectFormPayload;
  mode?: GenerationMode;
}) {
  const supabase = getSupabaseServerClient();
  const generated = await generateProjectOutputWithAI(input.payload, input.mode);
  const scored = evaluateProductionScoreByRules({
    payload: input.payload,
    bomGroups: generated.bom_groups,
    riskNotes: generated.risk_notes,
    mode: input.mode
  });
  const productionHintWithRules = `${RULE_DEDUCTION_MARKER}${scored.keyDeductions.join("||")}\n${
    generated.production_hint
  }`.trim();

  const { error } = await supabase.from("project_outputs").upsert({
    project_id: input.projectId,
    design_summary: generated.design_summary,
    design_positioning: generated.design_positioning,
    build_difficulty: generated.build_difficulty,
    structure_notes: generated.structure_notes,
    highlight_points: generated.highlight_points,
    bom_groups: generated.bom_groups,
    substitution_suggestions: generated.substitution_suggestions,
    risk_notes: generated.risk_notes,
    production_hint: productionHintWithRules,
    production_score: scored.finalScore,
    recommended_next_step: scored.recommendedNextStep,
    internal_recommendation: generated.internal_recommendation,
    recommended_service: scored.recommendedService,
    editable_version: buildEditableVersion(generated.editable_version)
  }, { onConflict: "project_id" });

  if (error) {
    throw new Error(`AI 结果写入失败: ${error.message}`);
  }
}

async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);

  if (error) {
    throw new Error(`项目状态更新失败: ${error.message}`);
  }
}

async function runGenerationLifecycleForProject(input: {
  projectId: string;
  payload: ProjectFormPayload;
  setGeneratingFirst: boolean;
  mode?: GenerationMode;
}) {
  let usedFallbackOutput = false;
  let warning: string | null = null;

  if (input.setGeneratingFirst) {
    await updateProjectStatus(input.projectId, "generating");
  }

  try {
    await createAiOutputForProject({
      projectId: input.projectId,
      payload: input.payload,
      mode: input.mode
    });
    await updateProjectStatus(input.projectId, "ready");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误";
    try {
      await createPlaceholderOutputForProject({
        projectId: input.projectId,
        payload: input.payload,
        fallbackReason: reason,
        mode: input.mode
      });
      await updateProjectStatus(input.projectId, "ready");
      usedFallbackOutput = true;
      warning = "当前先保留一版可继续判断的结果，建议稍后重新整理。";
    } catch {
      await updateProjectStatus(input.projectId, "failed");
      throw new Error("项目方案生成失败，请稍后重试。");
    }
  }

  return { usedFallbackOutput, warning };
}

export async function createProjectAndMaybeOutputForCurrentVisitor(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  const createdProject = await createProjectForCurrentVisitor(input);
  let usedFallbackOutput = false;
  let warning: string | null = null;

  if (input.status === "generating") {
    const generationResult = await runGenerationLifecycleForProject({
      projectId: createdProject.id,
      payload: input.payload,
      setGeneratingFirst: false
    });
    usedFallbackOutput = generationResult.usedFallbackOutput;
    warning = generationResult.warning;
  }

  return {
    ...createdProject,
    usedFallbackOutput,
    warning
  };
}

export async function createProjectAndMaybeOutputForDemoUser(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  return createProjectAndMaybeOutputForCurrentVisitor(input);
}

export async function regenerateProjectOutputForCurrentVisitor(projectId: string) {
  return regenerateProjectOutputByModeForCurrentVisitor({ projectId });
}

export async function regenerateProjectOutputForDemoUser(projectId: string) {
  return regenerateProjectOutputForCurrentVisitor(projectId);
}

export async function regenerateProjectOutputByModeForCurrentVisitor(input: {
  projectId: string;
  mode?: GenerationMode;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,category,style,size_target,size_note,audience,description,must_have_elements,avoid_elements,build_goal,collaboration_goal,willing_creator_plan,willing_sampling,reference_links,notes_for_factory"
    )
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();

  if (projectError) {
    throw new Error(`项目读取失败: ${projectError.message}`);
  }
  if (!projectData) {
    throw new Error("未找到该项目，无法重新生成。");
  }

  const payload = projectRowToPayload(projectData);
  return runGenerationLifecycleForProject({
    projectId: input.projectId,
    payload,
    setGeneratingFirst: true,
    mode: input.mode
  });
}

export async function regenerateProjectOutputByModeForDemoUser(input: {
  projectId: string;
  mode?: GenerationMode;
}) {
  return regenerateProjectOutputByModeForCurrentVisitor(input);
}

export async function listProjectsForCurrentVisitor() {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,title,status,updated_at,category,notes_for_factory")
    .eq("user_id", currentVisitorUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`项目读取失败: ${error.message}`);
  }

  const projectRows = (data ?? []) as ProjectRow[];
  const projectIds = projectRows.map((item) => item.id);

  if (projectIds.length === 0) return projectRows;

  const { data: intentRows, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,updated_at,operator_note")
    .eq("user_id", currentVisitorUser.id)
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  if (intentError) {
    throw new Error(`项目关联推进意向读取失败: ${intentError.message}`);
  }

  const latestIntentIds = (intentRows || []).map((row) => row.id);
  let quoteMap: Record<string, { quote_status: string; version: number }> = {};

  if (latestIntentIds.length > 0) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from("quote_sheets")
      .select("intent_id,quote_status,version")
      .in("intent_id", latestIntentIds)
      .order("version", { ascending: false });

    if (quoteError) {
      throw new Error(`项目关联报价说明读取失败: ${quoteError.message}`);
    }

    const quoteByIntent: Record<string, { quote_status: string; version: number }> = {};
    for (const row of quoteRows || []) {
      if (row.intent_id && !quoteByIntent[row.intent_id]) {
        quoteByIntent[row.intent_id] = {
          quote_status: row.quote_status,
          version: row.version
        };
      }
    }
    quoteMap = quoteByIntent;
  }

  const intentMap: Record<
    string,
    {
      id: string;
      source_type: string;
      status: string;
      updated_at: string;
      latest_quote_status?: string | null;
      latest_quote_version?: number | null;
      showcase_control?: ShowcaseDisplayControl | null;
    }
  > = {};
  for (const row of intentRows || []) {
    if (row.project_id && !intentMap[row.project_id]) {
      intentMap[row.project_id] = {
        ...row,
        latest_quote_status: quoteMap[row.id]?.quote_status || null,
        latest_quote_version: quoteMap[row.id]?.version ?? null,
        showcase_control: parseShowcaseDisplayControl(row.operator_note)
      };
    }
  }

  return projectRows.map((item) => ({
    ...item,
    linked_intent: intentMap[item.id] || null
  }));
}

async function buildLatestIntentMapByProjectIds(input: {
  projectIds: string[];
  userId?: string | null;
  sourceType?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  if (input.projectIds.length === 0) {
    return {} as Record<
      string,
      {
        id: string;
        source_type: string;
        status: string;
        updated_at: string;
        latest_quote_status?: string | null;
        latest_quote_version?: number | null;
        showcase_control?: ShowcaseDisplayControl | null;
      }
    >;
  }

  let intentQuery = supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,updated_at,operator_note")
    .in("project_id", input.projectIds)
    .order("updated_at", { ascending: false });

  if (input.userId?.trim()) {
    intentQuery = intentQuery.eq("user_id", input.userId.trim());
  }

  if (input.sourceType?.trim()) {
    intentQuery = intentQuery.eq("source_type", input.sourceType.trim());
  }

  const { data: intentRows, error: intentError } = await intentQuery;

  if (intentError) {
    throw new Error(`项目关联推进意向读取失败: ${intentError.message}`);
  }

  const latestIntentIds = (intentRows || []).map((row) => row.id);
  let quoteMap: Record<string, { quote_status: string; version: number }> = {};

  if (latestIntentIds.length > 0) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from("quote_sheets")
      .select("intent_id,quote_status,version")
      .in("intent_id", latestIntentIds)
      .order("version", { ascending: false });

    if (quoteError) {
      throw new Error(`项目关联报价说明读取失败: ${quoteError.message}`);
    }

    const quoteByIntent: Record<string, { quote_status: string; version: number }> = {};
    for (const row of quoteRows || []) {
      if (row.intent_id && !quoteByIntent[row.intent_id]) {
        quoteByIntent[row.intent_id] = {
          quote_status: row.quote_status,
          version: row.version
        };
      }
    }
    quoteMap = quoteByIntent;
  }

  const intentMap: Record<
    string,
    {
      id: string;
      source_type: string;
      status: string;
      updated_at: string;
      latest_quote_status?: string | null;
      latest_quote_version?: number | null;
      showcase_control?: ShowcaseDisplayControl | null;
    }
  > = {};

  for (const row of intentRows || []) {
    if (row.project_id && !intentMap[row.project_id]) {
      intentMap[row.project_id] = {
        ...row,
        latest_quote_status: quoteMap[row.id]?.quote_status || null,
        latest_quote_version: quoteMap[row.id]?.version ?? null,
        showcase_control: parseShowcaseDisplayControl(row.operator_note)
      };
    }
  }

  return intentMap;
}

export async function listProjectsByDemoUser() {
  return listProjectsForCurrentVisitor();
}

export type PublicShowcaseSortKey = "latest" | "popular" | "trial";

export type PublicShowcaseProjectListResult = {
  items: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function getPublicShowcaseProjectRank(project: ProjectRow, sort: PublicShowcaseSortKey) {
  const showcaseControl = project.linked_intent?.showcase_control;
  const latestOrder = new Date(project.linked_intent?.updated_at || project.updated_at).getTime();
  const featuredBoost = showcaseControl?.featured ? 40 : 0;
  const homepageBoost = showcaseControl?.homepage ? 60 : 0;
  const primary =
    sort === "popular"
      ? 92 + homepageBoost + featuredBoost
      : sort === "trial"
        ? 90 + featuredBoost + Math.floor(homepageBoost / 2)
        : 99 + homepageBoost + featuredBoost;
  return { primary, latestOrder };
}

export async function listPublicShowcaseProjects(input?: {
  page?: number;
  pageSize?: number;
  category?: string | null;
  sort?: PublicShowcaseSortKey | null;
}): Promise<PublicShowcaseProjectListResult> {
  const pageSize = Math.max(1, Math.min(input?.pageSize || 12, 48));
  const requestedPage = Math.max(1, input?.page || 1);
  const supabase = getSupabaseServerClient();
  const { data: intentRows, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,updated_at,operator_note")
    .eq("source_type", "crowdfunding")
    .order("updated_at", { ascending: false });

  if (intentError) {
    throw new Error(`公开展示意向读取失败: ${intentError.message}`);
  }

  const projectIds = Array.from(new Set((intentRows || []).map((item) => item.project_id).filter(Boolean)));
  if (projectIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: requestedPage,
      pageSize,
      totalPages: 0
    };
  }

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id,title,status,updated_at,category,notes_for_factory")
    .in("id", projectIds)
    .order("updated_at", { ascending: false });

  if (projectError) {
    throw new Error(`公开展示项目读取失败: ${projectError.message}`);
  }

  const projectRows = (projectData ?? []) as ProjectRow[];
  const intentMap = await buildLatestIntentMapByProjectIds({
    projectIds: projectRows.map((item) => item.id),
    sourceType: "crowdfunding"
  });

  const sort = input?.sort || "latest";
  const filtered = projectRows
    .map((item) => ({
      ...item,
      linked_intent: intentMap[item.id] || null
    }))
    .filter((item) => item.linked_intent?.source_type === "crowdfunding")
    .filter((item) => !item.linked_intent?.showcase_control?.paused)
    .filter((item) => isQuickProjectPubliclyVisible(item.notes_for_factory))
    .filter((item) =>
      input?.category?.trim() ? mapProjectCategoryToShowcaseCategory(item.category) === input.category.trim() : true
    )
    .sort((a, b) => {
      const rankA = getPublicShowcaseProjectRank(a, sort);
      const rankB = getPublicShowcaseProjectRank(b, sort);
      const primaryDiff = rankB.primary - rankA.primary;
      if (primaryDiff !== 0) return primaryDiff;
      return rankB.latestOrder - rankA.latestOrder;
    });

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages
  } satisfies PublicShowcaseProjectListResult;
}

export async function createQuickProjectForCurrentVisitor(input: {
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();
  const title = normalizeQuickProjectTitle({
    conceptTitle: input.quickResult.conceptTitle,
    rawIdea: input.quickInput.idea
  });

  const quickData: QuickProjectData = {
    input: input.quickInput,
    result: input.quickResult,
    textWarning: input.textWarning ?? "",
    ...buildDefaultQuickProjectImageMeta(),
    ...buildDefaultQuickProjectModerationMeta()
  };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: currentVisitorUser.id,
      title,
      status: "ready",
      category: "quick_entry",
      style: input.quickInput.style || null,
      size_target:
        input.quickInput.scale === "small"
          ? "small"
          : input.quickInput.scale === "medium"
            ? "medium"
            : input.quickInput.scale === "large"
              ? "large"
              : input.quickInput.direction === "display"
                ? "display"
                : input.quickInput.direction === "cost"
                  ? "small"
                  : "medium",
      description: input.quickInput.idea,
      notes_for_factory: encodeQuickProjectData(quickData)
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`轻量项目写入失败: ${error.message}`);
  }

  return data;
}

export async function createQuickProjectForDemoUser(input: {
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
}) {
  return createQuickProjectForCurrentVisitor(input);
}

export async function updateQuickProjectResultForCurrentVisitor(input: {
  projectId: string;
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
  resetImage?: boolean;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();
  const title = normalizeQuickProjectTitle({
    conceptTitle: input.quickResult.conceptTitle,
    rawIdea: input.quickInput.idea
  });

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,category,notes_for_factory")
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id)
    .eq("category", "quick_entry")
    .maybeSingle();

  if (error) {
    throw new Error(`轻量项目读取失败: ${error.message}`);
  }
  if (!data) {
    throw new Error("未找到轻量项目，无法更新结果。");
  }

  const previous = decodeQuickProjectData(data.notes_for_factory);
  const imageMeta = input.resetImage
    ? buildDefaultQuickProjectImageMeta()
    : {
        previewImageUrl: previous?.previewImageUrl ?? null,
        imageWarning: previous?.imageWarning ?? "",
        imageStatus: previous?.imageStatus ?? "idle",
        imageUpdatedAt: previous?.imageUpdatedAt ?? null,
        imageLastError: previous?.imageLastError ?? "",
        imageAttemptCount: previous?.imageAttemptCount ?? 0,
        imageModelAlias: previous?.imageModelAlias ?? null
      };
  const moderationMeta = previous
    ? {
        moderationStatus: previous.moderationStatus ?? "allow",
        moderationReason: previous.moderationReason ?? "",
        publishEligibility: previous.publishEligibility ?? "private_draft",
        imageModerationStatus: input.resetImage ? "pending" : previous.imageModerationStatus ?? "pending",
        lastModeratedAt: previous.lastModeratedAt ?? null,
        publishAttemptedAt: previous.publishAttemptedAt ?? null
      }
    : buildDefaultQuickProjectModerationMeta();
  const nextData: QuickProjectData = {
    input: input.quickInput,
    result: input.quickResult,
    textWarning: input.textWarning ?? "",
    ...imageMeta,
    ...moderationMeta
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      title,
      status: "ready",
      style: input.quickInput.style || null,
      size_target:
        input.quickInput.scale === "small"
          ? "small"
          : input.quickInput.scale === "medium"
            ? "medium"
            : input.quickInput.scale === "large"
              ? "large"
              : input.quickInput.direction === "display"
                ? "display"
                : input.quickInput.direction === "cost"
                  ? "small"
                  : "medium",
      description: input.quickInput.idea,
      notes_for_factory: encodeQuickProjectData(nextData)
    })
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id);

  if (updateError) {
    throw new Error(`轻量项目结果更新失败: ${updateError.message}`);
  }

  return { id: input.projectId };
}

export async function updateQuickProjectResultForDemoUser(input: {
  projectId: string;
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
}) {
  return updateQuickProjectResultForCurrentVisitor(input);
}

export async function getQuickProjectByIdForCurrentVisitor(projectId: string) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,title,status,updated_at,category,notes_for_factory")
    .eq("id", projectId)
    .eq("user_id", currentVisitorUser.id)
    .eq("category", "quick_entry")
    .maybeSingle();

  if (error) {
    throw new Error(`轻量项目读取失败: ${error.message}`);
  }
  if (!data) return null;

  const quickData = decodeQuickProjectData(data.notes_for_factory);
  if (!quickData) return null;

  return {
    id: data.id,
    title: data.title,
    status: data.status,
    updatedAt: data.updated_at,
    input: quickData.input,
    result: quickData.result,
    previewImageUrl: quickData.previewImageUrl ?? null,
    imageWarning: quickData.imageWarning ?? "",
    imageStatus: quickData.imageStatus ?? "idle",
    imageUpdatedAt: quickData.imageUpdatedAt ?? null,
    imageLastError: quickData.imageLastError ?? "",
    imageAttemptCount: quickData.imageAttemptCount ?? 0,
    imageModelAlias: quickData.imageModelAlias ?? null,
    textWarning: quickData.textWarning ?? "",
    moderationStatus: quickData.moderationStatus ?? "allow",
    moderationReason: quickData.moderationReason ?? "",
    publishEligibility: quickData.publishEligibility ?? "private_draft",
    imageModerationStatus: quickData.imageModerationStatus ?? "pending",
    lastModeratedAt: quickData.lastModeratedAt ?? null,
    publishAttemptedAt: quickData.publishAttemptedAt ?? null
  };
}

export async function getQuickProjectByIdForDemoUser(projectId: string) {
  return getQuickProjectByIdForCurrentVisitor(projectId);
}

export async function updateQuickProjectImageForCurrentVisitor(input: {
  projectId: string;
  idea?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
  imageStatus?: QuickImageStatus;
  imageUpdatedAt?: string | null;
  imageLastError?: string;
  imageAttemptCount?: number;
  imageModelAlias?: QuickImageModelAlias | null;
  moderationStatus?: QuickModerationStatus;
  moderationReason?: QuickModerationReason | "";
  publishEligibility?: QuickPublishEligibility;
  imageModerationStatus?: QuickImageModerationStatus;
  lastModeratedAt?: string | null;
  publishAttemptedAt?: string | null;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,category,notes_for_factory")
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id)
    .eq("category", "quick_entry")
    .maybeSingle();

  if (error) {
    throw new Error(`轻量项目更新失败: ${error.message}`);
  }
  if (!data) {
    throw new Error("未找到轻量项目，无法更新预览图。");
  }

  const quickData = decodeQuickProjectData(data.notes_for_factory);
  if (!quickData) {
    throw new Error("轻量项目数据缺失，无法更新预览图。");
  }
  if (input.idea && quickData.input.idea.trim() !== input.idea.trim()) {
    throw new Error("轻量项目校验失败，无法更新预览图。");
  }

  const nextPreviewImageUrl =
    typeof input.previewImageUrl === "string"
      ? input.previewImageUrl
      : input.previewImageUrl === null
        ? null
        : quickData.previewImageUrl ?? null;
  const didTouchImageState =
    input.previewImageUrl !== undefined ||
    input.imageWarning !== undefined ||
    input.imageStatus !== undefined ||
    input.imageUpdatedAt !== undefined ||
    input.imageLastError !== undefined ||
    input.imageAttemptCount !== undefined ||
    input.imageModelAlias !== undefined;
  const nextImageStatus = input.imageStatus
    ? input.imageStatus
    : nextPreviewImageUrl
      ? "succeeded"
      : typeof input.imageWarning === "string"
        ? "failed"
        : quickData.imageStatus ?? "idle";
  const nextData: QuickProjectData = {
    ...quickData,
    previewImageUrl: nextPreviewImageUrl,
    imageWarning:
      nextImageStatus === "failed"
        ? input.imageWarning ?? quickData.imageWarning ?? ""
        : "",
    imageStatus: nextImageStatus,
    imageUpdatedAt: didTouchImageState ? input.imageUpdatedAt ?? new Date().toISOString() : quickData.imageUpdatedAt ?? null,
    imageLastError:
      nextImageStatus === "failed"
        ? input.imageLastError ?? input.imageWarning ?? quickData.imageLastError ?? ""
        : "",
    imageAttemptCount:
      typeof input.imageAttemptCount === "number" ? input.imageAttemptCount : quickData.imageAttemptCount ?? 0,
    imageModelAlias:
      input.imageModelAlias === undefined ? quickData.imageModelAlias ?? null : input.imageModelAlias,
    moderationStatus:
      input.moderationStatus === undefined ? quickData.moderationStatus ?? "allow" : input.moderationStatus,
    moderationReason:
      input.moderationReason === undefined ? quickData.moderationReason ?? "" : input.moderationReason,
    publishEligibility:
      input.publishEligibility === undefined ? quickData.publishEligibility ?? "private_draft" : input.publishEligibility,
    imageModerationStatus:
      input.imageModerationStatus === undefined
        ? quickData.imageModerationStatus ?? "pending"
        : input.imageModerationStatus,
    lastModeratedAt:
      input.lastModeratedAt === undefined ? quickData.lastModeratedAt ?? null : input.lastModeratedAt,
    publishAttemptedAt:
      input.publishAttemptedAt === undefined ? quickData.publishAttemptedAt ?? null : input.publishAttemptedAt
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({ notes_for_factory: encodeQuickProjectData(nextData) })
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id);

  if (updateError) {
    throw new Error(`轻量项目预览图更新失败: ${updateError.message}`);
  }
}

export async function updateQuickProjectImageForDemoUser(input: {
  projectId: string;
  idea?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
}) {
  return updateQuickProjectImageForCurrentVisitor(input);
}

export async function reviewQuickProjectForPublicPublishForCurrentVisitor(input: {
  projectId: string;
  publishAttemptedAt?: string | null;
}) {
  const quickProject = await getQuickProjectByIdForCurrentVisitor(input.projectId);
  if (!quickProject) {
    throw new Error("未找到轻量项目，无法校验公开发布。");
  }

  const reviewed = reviewQuickProjectForPublicPublish({
    quickInput: quickProject.input,
    quickResult: quickProject.result,
    previewImageUrl: quickProject.previewImageUrl,
    imageWarning: quickProject.imageWarning,
    imageLastError: quickProject.imageLastError,
    previous: {
      moderationStatus: quickProject.moderationStatus,
      moderationReason: quickProject.moderationReason,
      publishEligibility: quickProject.publishEligibility,
      imageModerationStatus: quickProject.imageModerationStatus,
      lastModeratedAt: quickProject.lastModeratedAt,
      publishAttemptedAt: quickProject.publishAttemptedAt
    },
    publishAttemptedAt: input.publishAttemptedAt ?? new Date().toISOString()
  });

  await updateQuickProjectImageForCurrentVisitor({
    projectId: input.projectId,
    idea: quickProject.input.idea,
    moderationStatus: reviewed.moderationStatus,
    moderationReason: reviewed.moderationReason,
    publishEligibility: reviewed.publishEligibility,
    imageModerationStatus: reviewed.imageModerationStatus,
    lastModeratedAt: reviewed.lastModeratedAt,
    publishAttemptedAt: reviewed.publishAttemptedAt
  });

  return reviewed;
}

export async function markQuickProjectModerationBlockedForCurrentVisitor(input: {
  projectId: string;
  idea: string;
  reason: QuickModerationReason;
  imageModerationStatus?: QuickImageModerationStatus;
}) {
  const nextMeta = buildBlockedModerationMeta(input.reason);
  await updateQuickProjectImageForCurrentVisitor({
    projectId: input.projectId,
    idea: input.idea,
    moderationStatus: nextMeta.moderationStatus,
    moderationReason: nextMeta.moderationReason,
    publishEligibility: nextMeta.publishEligibility,
    imageModerationStatus: input.imageModerationStatus ?? nextMeta.imageModerationStatus,
    lastModeratedAt: nextMeta.lastModeratedAt
  });
}

export async function getProjectWithOutputById(projectId: string) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id,title,category,style,size_target,audience,status,updated_at,notes_for_factory")
    .eq("id", projectId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();

  if (projectError) {
    throw new Error(`项目详情读取失败: ${projectError.message}`);
  }

  if (!projectData) {
    return null;
  }

  const { data: outputData, error: outputError } = await supabase
    .from("project_outputs")
    .select(
      "id,project_id,design_summary,design_positioning,build_difficulty,structure_notes,highlight_points,bom_groups,substitution_suggestions,risk_notes,production_hint,production_score,recommended_next_step,internal_recommendation,recommended_service,editable_version,created_at,updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (outputError) {
    throw new Error(`项目结果读取失败: ${outputError.message}`);
  }

  const { data: intentRows, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,updated_at,operator_note")
    .eq("user_id", currentVisitorUser.id)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (intentError) {
    throw new Error(`项目关联推进意向读取失败: ${intentError.message}`);
  }

  const latestIntent = intentRows?.[0] || null;
  let linkedIntentWithSummary: ProjectDetailRow["linked_intent"] = latestIntent;
  let allLinkedIntentSummaries: NonNullable<ProjectDetailRow["all_linked_intents"]> = [];

  if (intentRows && intentRows.length > 0) {
    const intentIds = intentRows.map((item) => item.id);
    const [{ data: latestQuoteRows, error: latestQuoteError }, { data: followupRows, error: followupError }] =
      await Promise.all([
        supabase
          .from("quote_sheets")
          .select("intent_id,quote_status,version,created_at")
          .in("intent_id", intentIds)
          .order("version", { ascending: false }),
        supabase
          .from("intent_followups")
          .select("id,intent_id,action_type,content,from_status,to_status,created_at")
          .in("intent_id", intentIds)
          .order("created_at", { ascending: false })
      ]);

    if (latestQuoteError) {
      throw new Error(`项目关联报价读取失败: ${latestQuoteError.message}`);
    }

    if (followupError) {
      throw new Error(`项目关联推进动态读取失败: ${followupError.message}`);
    }

    const quoteMap: Record<string, { quote_status: string; version: number }> = {};
    for (const row of latestQuoteRows || []) {
      if (row.intent_id && !quoteMap[row.intent_id]) {
        quoteMap[row.intent_id] = {
          quote_status: row.quote_status,
          version: row.version
        };
      }
    }

    const followupMap: Record<
      string,
      Array<{
        id: string;
        action_type: string | null;
        content: string | null;
        from_status?: string | null;
        to_status?: string | null;
        created_at: string;
      }>
    > = {};

    for (const row of followupRows || []) {
      if (!row.intent_id) continue;
      if (!followupMap[row.intent_id]) {
        followupMap[row.intent_id] = [];
      }
      if (followupMap[row.intent_id].length < 3) {
        followupMap[row.intent_id].push({
          id: row.id,
          action_type: row.action_type,
          content: row.content,
          from_status: row.from_status,
          to_status: row.to_status,
          created_at: row.created_at
        });
      }
    }

    allLinkedIntentSummaries = intentRows.map((item) => ({
      ...item,
      latest_quote_status: quoteMap[item.id]?.quote_status ?? null,
      latest_quote_version: quoteMap[item.id]?.version ?? null,
      showcase_control: parseShowcaseDisplayControl(item.operator_note),
      latest_followup: followupMap[item.id]?.[0] || null
    }));

    if (latestIntent) {
      linkedIntentWithSummary = {
        ...latestIntent,
        latest_quote_status: quoteMap[latestIntent.id]?.quote_status ?? null,
        latest_quote_version: quoteMap[latestIntent.id]?.version ?? null,
        showcase_control: parseShowcaseDisplayControl(latestIntent.operator_note),
        recent_followups: followupMap[latestIntent.id] ?? []
      };
    }
  }

  return {
    project: {
      ...(projectData as ProjectDetailRow),
      linked_intent: linkedIntentWithSummary,
      all_linked_intents: allLinkedIntentSummaries
    },
    output: (outputData as ProjectOutputRow | null) ?? null
  };
}

export async function getPublicProjectWithOutputById(projectId: string) {
  const supabase = getSupabaseServerClient();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id,title,category,style,size_target,audience,status,updated_at,notes_for_factory")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(`公开项目详情读取失败: ${projectError.message}`);
  }

  if (!projectData) {
    return null;
  }

  const { data: outputData, error: outputError } = await supabase
    .from("project_outputs")
    .select(
      "id,project_id,design_summary,design_positioning,build_difficulty,structure_notes,highlight_points,bom_groups,substitution_suggestions,risk_notes,production_hint,production_score,recommended_next_step,internal_recommendation,recommended_service,editable_version,created_at,updated_at"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (outputError) {
    throw new Error(`公开项目结果读取失败: ${outputError.message}`);
  }

  const { data: intentRows, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,updated_at,operator_note")
    .eq("project_id", projectId)
    .eq("source_type", "crowdfunding")
    .order("updated_at", { ascending: false });

  if (intentError) {
    throw new Error(`公开项目关联推进意向读取失败: ${intentError.message}`);
  }

  const latestIntent = intentRows?.[0] || null;
  let linkedIntentWithSummary: ProjectDetailRow["linked_intent"] = latestIntent;
  let allLinkedIntentSummaries: NonNullable<ProjectDetailRow["all_linked_intents"]> = [];

  if (intentRows && intentRows.length > 0) {
    const intentIds = intentRows.map((item) => item.id);
    const [{ data: latestQuoteRows, error: latestQuoteError }, { data: followupRows, error: followupError }] =
      await Promise.all([
        supabase
          .from("quote_sheets")
          .select("intent_id,quote_status,version,created_at")
          .in("intent_id", intentIds)
          .order("version", { ascending: false }),
        supabase
          .from("intent_followups")
          .select("id,intent_id,action_type,content,from_status,to_status,created_at")
          .in("intent_id", intentIds)
          .order("created_at", { ascending: false })
      ]);

    if (latestQuoteError) {
      throw new Error(`公开项目关联报价读取失败: ${latestQuoteError.message}`);
    }

    if (followupError) {
      throw new Error(`公开项目关联推进动态读取失败: ${followupError.message}`);
    }

    const quoteMap: Record<string, { quote_status: string; version: number }> = {};
    for (const row of latestQuoteRows || []) {
      if (row.intent_id && !quoteMap[row.intent_id]) {
        quoteMap[row.intent_id] = {
          quote_status: row.quote_status,
          version: row.version
        };
      }
    }

    const followupMap: Record<
      string,
      Array<{
        id: string;
        action_type: string | null;
        content: string | null;
        from_status?: string | null;
        to_status?: string | null;
        created_at: string;
      }>
    > = {};

    for (const row of followupRows || []) {
      if (!row.intent_id) continue;
      if (!followupMap[row.intent_id]) {
        followupMap[row.intent_id] = [];
      }
      if (followupMap[row.intent_id].length < 3) {
        followupMap[row.intent_id].push({
          id: row.id,
          action_type: row.action_type,
          content: row.content,
          from_status: row.from_status,
          to_status: row.to_status,
          created_at: row.created_at
        });
      }
    }

    allLinkedIntentSummaries = intentRows.map((item) => ({
      ...item,
      latest_quote_status: quoteMap[item.id]?.quote_status ?? null,
      latest_quote_version: quoteMap[item.id]?.version ?? null,
      showcase_control: parseShowcaseDisplayControl(item.operator_note),
      latest_followup: followupMap[item.id]?.[0] || null
    }));

    if (latestIntent) {
      linkedIntentWithSummary = {
        ...latestIntent,
        latest_quote_status: quoteMap[latestIntent.id]?.quote_status ?? null,
        latest_quote_version: quoteMap[latestIntent.id]?.version ?? null,
        showcase_control: parseShowcaseDisplayControl(latestIntent.operator_note),
        recent_followups: followupMap[latestIntent.id] ?? []
      };
    }
  }

  return {
    project: {
      ...(projectData as ProjectDetailRow),
      linked_intent: linkedIntentWithSummary,
      all_linked_intents: allLinkedIntentSummaries
    },
    output: (outputData as ProjectOutputRow | null) ?? null
  };
}

export async function createServiceRequestForCurrentVisitor(input: CreateServiceRequestInput) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      project_id: input.projectId,
      user_id: currentVisitorUser.id,
      request_type: input.requestType,
      contact_info: input.contactInfo,
      request_note: input.requestNote,
      metadata: input.metadata
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`申请写入失败: ${error.message}`);
  }

  return data;
}

export async function createServiceRequestForDemoUser(input: CreateServiceRequestInput) {
  return createServiceRequestForCurrentVisitor(input);
}

export async function listServiceRequestsForCurrentVisitor(input?: { status?: string; limit?: number; offset?: number }) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();
  const limit = Math.max(1, Math.min(input?.limit || 20, 100));
  const offset = Math.max(0, input?.offset || 0);

  let query = supabase
    .from("service_requests")
    .select("id,project_id,user_id,request_type,contact_info,request_note,metadata,status,operator_note,handled_by,responded_at,created_at,updated_at", {
      count: "exact"
    })
    .eq("user_id", currentVisitorUser.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input?.status?.trim()) {
    query = query.eq("status", ensureServiceRequestStatus(input.status.trim()));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`服务申请列表读取失败: ${error.message}`);

  const projectIds = Array.from(new Set((data || []).map((item) => item.project_id).filter(Boolean)));
  let projectTitleMap: Record<string, string | null> = {};
  if (projectIds.length > 0) {
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id,title")
      .in("id", projectIds);
    if (projectError) throw new Error(`服务申请关联项目读取失败: ${projectError.message}`);
    projectTitleMap = Object.fromEntries((projects || []).map((item) => [item.id, item.title]));
  }

  return {
    items: (data || []).map((item) => ({
      ...(item as ServiceRequestRow),
      project_title: projectTitleMap[item.project_id] ?? null
    })),
    total: count || 0,
    limit,
    offset,
    hasMore: offset + (data?.length || 0) < (count || 0)
  };
}

export async function listServiceRequestsForDemoUser(input?: { status?: string; limit?: number; offset?: number }) {
  return listServiceRequestsForCurrentVisitor(input);
}

export async function listServiceRequestsForAdmin(input: {
  status?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  adminToken?: string | null;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const limit = Math.max(1, Math.min(input.limit || 30, 200));
  const offset = Math.max(0, input.offset || 0);

  let query = supabase
    .from("service_requests")
    .select("id,project_id,user_id,request_type,contact_info,request_note,metadata,status,operator_note,handled_by,responded_at,created_at,updated_at", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.status?.trim()) {
    query = query.eq("status", ensureServiceRequestStatus(input.status.trim()));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`管理端服务申请列表读取失败: ${error.message}`);

  const projectIds = Array.from(new Set((data || []).map((item) => item.project_id).filter(Boolean)));
  let projectTitleMap: Record<string, string | null> = {};
  if (projectIds.length > 0) {
    const { data: projects, error: projectError } = await supabase
      .from("projects")
      .select("id,title")
      .in("id", projectIds);
    if (projectError) throw new Error(`管理端服务申请关联项目读取失败: ${projectError.message}`);
    projectTitleMap = Object.fromEntries((projects || []).map((item) => [item.id, item.title]));
  }

  let items = (data || []).map((item) => ({
    ...(item as ServiceRequestRow),
    project_title: projectTitleMap[item.project_id] ?? null
  }));

  if (input.keyword?.trim()) {
    const keyword = input.keyword.trim().toLowerCase();
    items = items.filter(
      (item) =>
        item.id.toLowerCase().includes(keyword) ||
        item.contact_info.toLowerCase().includes(keyword) ||
        (item.project_title || "").toLowerCase().includes(keyword)
    );
  }

  return {
    items,
    total: input.keyword?.trim() ? items.length : count || 0,
    limit,
    offset,
    hasMore: offset + items.length < (input.keyword?.trim() ? items.length : count || 0)
  };
}

export async function updateServiceRequestStatusForAdmin(input: {
  requestId: string;
  toStatus: string;
  note?: string;
  adminToken?: string | null;
  actorId?: string;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const toStatus = ensureServiceRequestStatus(input.toStatus.trim());

  const { data, error } = await supabase
    .from("service_requests")
    .select("id,status")
    .eq("id", input.requestId)
    .maybeSingle();
  if (error) throw new Error(`服务申请读取失败: ${error.message}`);
  if (!data) throw new Error("服务申请不存在");

  const updatePayload: {
    status: ServiceRequestStatus;
    operator_note: string | null;
    handled_by: string;
    responded_at?: string | null;
  } = {
    status: toStatus,
    operator_note: (input.note || "").trim() || null,
    handled_by: input.actorId || "admin"
  };

  if (toStatus === "responded" || toStatus === "converted" || toStatus === "closed") {
    updatePayload.responded_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("service_requests")
    .update(updatePayload)
    .eq("id", input.requestId);
  if (updateError) throw new Error(`服务申请状态更新失败: ${updateError.message}`);

  return {
    requestId: input.requestId,
    fromStatus: data.status,
    toStatus
  };
}

export async function updateManualEditForCurrentVisitor(input: {
  projectId: string;
  manualEditContent: string;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", input.projectId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();

  if (projectError) {
    throw new Error(`项目校验失败: ${projectError.message}`);
  }
  if (!projectData) {
    throw new Error("未找到该项目，无法保存人工编辑内容。");
  }

  const editableVersion = buildEditableVersion(input.manualEditContent);
  const { error } = await supabase
    .from("project_outputs")
    .upsert(
      {
        project_id: input.projectId,
        editable_version: editableVersion
      },
      { onConflict: "project_id" }
    );

  if (error) {
    throw new Error(`人工编辑内容保存失败: ${error.message}`);
  }
}

export async function updateManualEditForDemoUser(input: {
  projectId: string;
  manualEditContent: string;
}) {
  return updateManualEditForCurrentVisitor(input);
}

const VALID_INTENT_STATUSES: IntentStatus[] = [
  "new",
  "contact_pending",
  "contacted",
  "confirming",
  "quoted",
  "deposit_pending",
  "locked",
  "preparing_delivery",
  "delivering",
  "delivered",
  "closed_won",
  "closed_lost"
];

const VALID_SOURCE_TYPES: IntentSourceType[] = [
  "small_batch",
  "crowdfunding",
  "pro_upgrade",
  "manual_consult"
];

const VALID_QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "accepted",
  "expired",
  "replaced",
  "converted_to_order"
];

const VALID_SERVICE_REQUEST_STATUSES: ServiceRequestStatus[] = [
  "pending",
  "reviewing",
  "responded",
  "converted",
  "closed"
];

function ensureIntentStatus(input: string): IntentStatus {
  if (!VALID_INTENT_STATUSES.includes(input as IntentStatus)) {
    throw new Error("意向单状态不合法");
  }
  return input as IntentStatus;
}

function ensureSourceType(input: string): IntentSourceType {
  if (!VALID_SOURCE_TYPES.includes(input as IntentSourceType)) {
    throw new Error("意向来源不合法");
  }
  return input as IntentSourceType;
}

function ensureQuoteStatus(input: string): QuoteStatus {
  if (!VALID_QUOTE_STATUSES.includes(input as QuoteStatus)) {
    throw new Error("报价单状态不合法");
  }
  return input as QuoteStatus;
}

function ensureServiceRequestStatus(input: string): ServiceRequestStatus {
  if (!VALID_SERVICE_REQUEST_STATUSES.includes(input as ServiceRequestStatus)) {
    throw new Error("服务申请状态不合法");
  }
  return input as ServiceRequestStatus;
}

function normalizeIntentSnapshotKind(value: unknown): "quick_publish" | "purchase_interest" | null {
  return value === "quick_publish" || value === "purchase_interest" ? value : null;
}

const LIGHTWEIGHT_INTENT_CONTACT_PLACEHOLDER = "待补充（公开发布后补）";

function isLightweightCrowdfundingIntent(input: CreateIntentInput) {
  if (input.sourceType !== "crowdfunding") return false;
  const intentKind = normalizeIntentSnapshotKind(input.snapshot?.intentKind);
  return intentKind === "quick_publish" || intentKind === "purchase_interest";
}

function buildIntentSnapshotUiContext(input: CreateIntentInput["snapshot"]) {
  return {
    ...(input.uiContext ?? {}),
    ...(normalizeIntentSnapshotKind(input.intentKind) ? { intentKind: input.intentKind } : {})
  };
}

function resolveIntentContactValue(input: {
  contactPhoneOrWechat?: string | null;
  allowPlaceholder: boolean;
}) {
  const trimmed = (input.contactPhoneOrWechat || "").trim();
  if (trimmed) return trimmed;
  return input.allowPlaceholder ? LIGHTWEIGHT_INTENT_CONTACT_PLACEHOLDER : "";
}

export async function createIntentForCurrentVisitor(input: CreateIntentInput) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();
  const allowPlaceholderContact = isLightweightCrowdfundingIntent(input);

  if (!input.contactPhoneOrWechat?.trim() && !allowPlaceholderContact) {
    throw new Error("请填写手机号或微信");
  }

  if (input.projectId?.trim()) {
    if (!isUuid(input.projectId)) {
      throw new Error("projectId 格式不合法");
    }
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id,user_id")
      .eq("id", input.projectId)
      .eq("user_id", currentVisitorUser.id)
      .maybeSingle();
    if (projectError) throw new Error(`项目校验失败: ${projectError.message}`);
    if (!projectData) throw new Error("项目不存在或无权限创建该意向单");
  }

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .insert({
      project_id: input.projectId?.trim() || null,
      user_id: currentVisitorUser.id,
      source_type: ensureSourceType(input.sourceType),
      status: "new",
      priority: "normal",
      contact_name: input.contactName?.trim() || null,
      contact_phone_or_wechat: resolveIntentContactValue({
        contactPhoneOrWechat: input.contactPhoneOrWechat,
        allowPlaceholder: allowPlaceholderContact
      }),
      contact_preference: input.contactPreference?.trim() || null,
      prefer_priority_contact: Boolean(input.preferPriorityContact),
      operator_note: input.operatorNote?.trim() || null
    })
    .select("id,status,created_at")
    .single();

  if (intentError || !intentData) {
    throw new Error(`意向单创建失败: ${intentError?.message || "未知错误"}`);
  }

  const snapshotPayload = input.snapshot || {};
  const { error: snapshotError } = await supabase.from("intent_snapshots").insert({
    intent_id: intentData.id,
    project_title: snapshotPayload.projectTitle?.trim() || null,
    result_summary: snapshotPayload.resultSummary?.trim() || null,
    selected_quantity: snapshotPayload.selectedQuantity ?? null,
    package_level: snapshotPayload.packageLevel?.trim() || null,
    design_service_level: snapshotPayload.designServiceLevel?.trim() || null,
    sale_mode: snapshotPayload.saleMode?.trim() || null,
    crowdfunding_target_people: snapshotPayload.crowdfundingTargetPeople ?? null,
    estimated_unit_price_min: snapshotPayload.estimatedUnitPriceMin ?? null,
    estimated_unit_price_max: snapshotPayload.estimatedUnitPriceMax ?? null,
    estimated_total_price_min: snapshotPayload.estimatedTotalPriceMin ?? null,
    estimated_total_price_max: snapshotPayload.estimatedTotalPriceMax ?? null,
    discount_amount: snapshotPayload.discountAmount ?? 0,
    pricing_meta: snapshotPayload.pricingMeta ?? {},
    ui_context: buildIntentSnapshotUiContext(snapshotPayload)
  });
  if (snapshotError) throw new Error(`意向快照写入失败: ${snapshotError.message}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: intentData.id,
    action_type: "status_change",
    to_status: "new",
    content: "用户提交意向单",
    actor_id: "system"
  });
  if (followupError) throw new Error(`意向跟进记录写入失败: ${followupError.message}`);

  return intentData;
}

export async function createIntentForDemoUser(input: CreateIntentInput) {
  return createIntentForCurrentVisitor(input);
}

export async function updateIntentForCurrentVisitor(input: {
  intentId: string;
  contactPhoneOrWechat?: string;
  contactPreference?: string;
  preferPriorityContact?: boolean;
  snapshot?: {
    intentKind?: "quick_publish" | "purchase_interest";
    saleMode?: string;
    crowdfundingTargetPeople?: number;
    uiContext?: Record<string, unknown>;
  };
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,user_id,source_type,status,contact_phone_or_wechat,contact_preference,prefer_priority_contact")
    .eq("id", input.intentId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();
  if (intentError) throw new Error(`意向单读取失败: ${intentError.message}`);
  if (!intentData) throw new Error("这条记录不存在或无权限修改。");

  const latestSnapshotPromise = supabase
    .from("intent_snapshots")
    .select("*")
    .eq("intent_id", input.intentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestSnapshot, error: latestSnapshotError } = await latestSnapshotPromise;
  if (latestSnapshotError) throw new Error(`意向快照读取失败: ${latestSnapshotError.message}`);

  const allowPlaceholderContact =
    intentData.source_type === "crowdfunding" &&
    normalizeIntentSnapshotKind((latestSnapshot?.ui_context as { intentKind?: unknown } | null)?.intentKind) !== null;
  const normalizedContact =
    input.contactPhoneOrWechat === undefined
      ? undefined
      : resolveIntentContactValue({
          contactPhoneOrWechat: input.contactPhoneOrWechat,
          allowPlaceholder: allowPlaceholderContact
        });
  const normalizedPreference =
    input.contactPreference === undefined ? undefined : input.contactPreference.trim() || null;
  const shouldUpdateIntentOrder =
    normalizedContact !== undefined ||
    normalizedPreference !== undefined ||
    typeof input.preferPriorityContact === "boolean";

  if (shouldUpdateIntentOrder) {
    const { error: updateIntentError } = await supabase
      .from("intent_orders")
      .update({
        contact_phone_or_wechat:
          normalizedContact === undefined ? intentData.contact_phone_or_wechat : normalizedContact,
        contact_preference:
          normalizedPreference === undefined ? intentData.contact_preference : normalizedPreference,
        prefer_priority_contact:
          typeof input.preferPriorityContact === "boolean"
            ? input.preferPriorityContact
            : intentData.prefer_priority_contact
      })
      .eq("id", input.intentId)
      .eq("user_id", currentVisitorUser.id);
    if (updateIntentError) throw new Error(`意向单更新失败: ${updateIntentError.message}`);
  }

  if (input.snapshot) {
    const mergedUiContext = {
      ...((latestSnapshot?.ui_context as Record<string, unknown> | null) ?? {}),
      ...(input.snapshot.uiContext ?? {}),
      ...(normalizeIntentSnapshotKind(input.snapshot.intentKind)
        ? { intentKind: input.snapshot.intentKind }
        : {})
    };

    const { error: snapshotError } = await supabase.from("intent_snapshots").insert({
      intent_id: input.intentId,
      project_title: latestSnapshot?.project_title ?? null,
      result_summary: latestSnapshot?.result_summary ?? null,
      selected_quantity: latestSnapshot?.selected_quantity ?? null,
      package_level: latestSnapshot?.package_level ?? null,
      design_service_level: latestSnapshot?.design_service_level ?? null,
      sale_mode:
        input.snapshot.saleMode === undefined ? latestSnapshot?.sale_mode ?? null : input.snapshot.saleMode || null,
      crowdfunding_target_people:
        input.snapshot.crowdfundingTargetPeople === undefined
          ? latestSnapshot?.crowdfunding_target_people ?? null
          : input.snapshot.crowdfundingTargetPeople,
      estimated_unit_price_min: latestSnapshot?.estimated_unit_price_min ?? null,
      estimated_unit_price_max: latestSnapshot?.estimated_unit_price_max ?? null,
      estimated_total_price_min: latestSnapshot?.estimated_total_price_min ?? null,
      estimated_total_price_max: latestSnapshot?.estimated_total_price_max ?? null,
      discount_amount: latestSnapshot?.discount_amount ?? 0,
      pricing_meta: latestSnapshot?.pricing_meta ?? {},
      ui_context: mergedUiContext
    });
    if (snapshotError) throw new Error(`意向快照更新失败: ${snapshotError.message}`);
  }

  const followupSegments: string[] = [];
  if (normalizedContact !== undefined) {
    followupSegments.push(normalizedContact ? "补充了联系方式" : "清空了联系方式");
  }
  if (normalizedPreference !== undefined) {
    followupSegments.push(normalizedPreference ? "补充了联系偏好" : "清空了联系偏好");
  }
  if (typeof input.preferPriorityContact === "boolean") {
    followupSegments.push(input.preferPriorityContact ? "希望优先沟通" : "取消优先沟通");
  }
  if (input.snapshot?.crowdfundingTargetPeople !== undefined) {
    followupSegments.push(`更新了目标人数为 ${input.snapshot.crowdfundingTargetPeople} 人`);
  }

  if (followupSegments.length > 0) {
    const { error: followupError } = await supabase.from("intent_followups").insert({
      intent_id: input.intentId,
      action_type: "user_updated",
      from_status: intentData.status,
      to_status: intentData.status,
      content: followupSegments.join("；"),
      actor_id: currentVisitorUser.id
    });
    if (followupError) throw new Error(`意向跟进记录写入失败: ${followupError.message}`);
  }

  return { id: input.intentId };
}

export async function listIntentsForCurrentVisitor(input?: { limit?: number; offset?: number; status?: string }) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();
  const limit = Math.max(1, Math.min(input?.limit || 20, 100));
  const offset = Math.max(0, input?.offset || 0);

  let query = supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,priority,contact_phone_or_wechat,created_at,updated_at", {
      count: "exact"
    })
    .eq("user_id", currentVisitorUser.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input?.status?.trim()) {
    query = query.eq("status", ensureIntentStatus(input.status.trim()));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`意向单列表读取失败: ${error.message}`);

  const ids = (data || []).map((item) => item.id);
  let snapshotMap: Record<string, unknown> = {};
  let followupMap: Record<string, unknown> = {};
  let quoteMap: Record<string, unknown> = {};
  if (ids.length > 0) {
    const [
      { data: snapshots, error: snapshotError },
      { data: followups, error: followupError },
      { data: quoteRows, error: quoteError }
    ] = await Promise.all([
      supabase
        .from("intent_snapshots")
        .select("intent_id,project_title,estimated_total_price_min,estimated_total_price_max,crowdfunding_target_people,ui_context,created_at")
        .in("intent_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("intent_followups")
        .select("intent_id,action_type,content,from_status,to_status,created_at")
        .in("intent_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("quote_sheets")
        .select("intent_id,quote_status,version,created_at")
        .in("intent_id", ids)
        .order("version", { ascending: false })
    ]);
    if (snapshotError) throw new Error(`意向快照列表读取失败: ${snapshotError.message}`);
    if (followupError) throw new Error(`意向跟进列表读取失败: ${followupError.message}`);
    if (quoteError) throw new Error(`意向报价列表读取失败: ${quoteError.message}`);
    const snapshotByIntent: Record<string, unknown> = {};
    for (const row of snapshots || []) {
      if (!snapshotByIntent[row.intent_id]) snapshotByIntent[row.intent_id] = row;
    }
    snapshotMap = snapshotByIntent;
    const followupByIntent: Record<string, unknown> = {};
    for (const row of followups || []) {
      if (!followupByIntent[row.intent_id]) followupByIntent[row.intent_id] = row;
    }
    followupMap = followupByIntent;
    const quoteByIntent: Record<string, unknown> = {};
    for (const row of quoteRows || []) {
      if (!quoteByIntent[row.intent_id]) quoteByIntent[row.intent_id] = row;
    }
    quoteMap = quoteByIntent;
  }

  return {
    items: (data || []).map((item) => ({
      ...item,
      latest_snapshot: snapshotMap[item.id] || null,
      latest_followup: followupMap[item.id] || null,
      latest_quote_status: (quoteMap[item.id] as { quote_status?: string } | undefined)?.quote_status || null,
      latest_quote_version: (quoteMap[item.id] as { version?: number } | undefined)?.version ?? null
    })),
    total: count || 0,
    limit,
    offset,
    hasMore: offset + (data?.length || 0) < (count || 0)
  };
}

export async function listIntentsForDemoUser(input?: { limit?: number; offset?: number; status?: string }) {
  return listIntentsForCurrentVisitor(input);
}

export async function getIntentDetailForCurrentVisitor(intentId: string) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("*")
    .eq("id", intentId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();
  if (intentError) throw new Error(`意向单详情读取失败: ${intentError.message}`);
  if (!intentData) return null;

  const [{ data: snapshots, error: snapshotError }, { data: followups, error: followupError }, { data: quotes, error: quoteError }] =
    await Promise.all([
      supabase
        .from("intent_snapshots")
        .select("*")
        .eq("intent_id", intentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("intent_followups")
        .select("*")
        .eq("intent_id", intentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("quote_sheets")
        .select("*")
        .eq("intent_id", intentId)
        .order("version", { ascending: false })
    ]);

  if (snapshotError) throw new Error(`意向快照读取失败: ${snapshotError.message}`);
  if (followupError) throw new Error(`意向跟进读取失败: ${followupError.message}`);
  if (quoteError) throw new Error(`报价单读取失败: ${quoteError.message}`);

  return {
    intent: intentData,
    snapshots: snapshots || [],
    followups: followups || [],
    quotes: quotes || []
  };
}

export async function getIntentDetailForDemoUser(intentId: string) {
  return getIntentDetailForCurrentVisitor(intentId);
}

export async function acceptQuoteForCurrentVisitor(input: { quoteId: string }) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: quoteData, error: quoteError } = await supabase
    .from("quote_sheets")
    .select("id,intent_id,quote_status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (quoteError) throw new Error(`报价单读取失败: ${quoteError.message}`);
  if (!quoteData) throw new Error("报价单不存在");
  if (quoteData.quote_status === "accepted") throw new Error("该报价单已确认，无需重复操作。");
  if (!["draft", "sent"].includes(quoteData.quote_status)) {
    throw new Error("该报价单当前状态不可确认，请联系人工处理。");
  }

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,user_id,status")
    .eq("id", quoteData.intent_id)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();
  if (intentError) throw new Error(`意向单校验失败: ${intentError.message}`);
  if (!intentData) throw new Error("意向单不存在或无权限");

  const { error: updateQuoteError } = await supabase
    .from("quote_sheets")
    .update({ quote_status: "accepted" })
    .eq("id", input.quoteId);
  if (updateQuoteError) throw new Error(`报价单确认失败: ${updateQuoteError.message}`);

  const { error: updateIntentError } = await supabase
    .from("intent_orders")
    .update({ status: "deposit_pending" })
    .eq("id", intentData.id);
  if (updateIntentError) throw new Error(`意向单状态更新失败: ${updateIntentError.message}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: intentData.id,
    action_type: "quote_accepted",
    from_status: intentData.status,
    to_status: "deposit_pending",
    content: "用户确认报价，等待定金锁单",
    actor_id: currentVisitorUser.id
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return { quoteId: input.quoteId, intentId: intentData.id };
}

export async function acceptQuoteForDemoUser(input: { quoteId: string }) {
  return acceptQuoteForCurrentVisitor(input);
}

export async function submitDepositForCurrentVisitor(input: {
  intentId: string;
  amount: number;
  paymentChannel?: string;
  voucherNote?: string;
  voucherUrl?: string;
}) {
  const supabase = getSupabaseServerClient();
  const currentVisitorUser = await ensureCurrentVisitorUser();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,user_id,status")
    .eq("id", input.intentId)
    .eq("user_id", currentVisitorUser.id)
    .maybeSingle();
  if (intentError) throw new Error(`意向单校验失败: ${intentError.message}`);
  if (!intentData) throw new Error("意向单不存在或无权限");
  if (intentData.status !== "deposit_pending") {
    throw new Error("当前状态不允许提交定金凭证，请先确认报价。");
  }

  const amount = Math.max(0, Number(input.amount || 0));
  if (!amount) throw new Error("请填写有效的定金金额。");

  const paymentChannel = (input.paymentChannel || "").trim();
  const voucherNote = (input.voucherNote || "").trim();
  const voucherUrl = (input.voucherUrl || "").trim();

  const { error: updateIntentError } = await supabase
    .from("intent_orders")
    .update({ status: "locked" })
    .eq("id", input.intentId);
  if (updateIntentError) throw new Error(`意向单状态更新失败: ${updateIntentError.message}`);

  const segments = [`已提交定金凭证：¥${amount}`];
  if (paymentChannel) segments.push(`支付方式：${paymentChannel}`);
  if (voucherNote) segments.push(`备注：${voucherNote}`);
  if (voucherUrl) segments.push(`凭证链接：${voucherUrl}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: input.intentId,
    action_type: "deposit_submitted",
    from_status: "deposit_pending",
    to_status: "locked",
    content: segments.join("；"),
    actor_id: currentVisitorUser.id
  });
  if (followupError) throw new Error(`定金记录写入失败: ${followupError.message}`);

  return { intentId: input.intentId, fromStatus: "deposit_pending", toStatus: "locked" as const };
}

export async function submitDepositForDemoUser(input: {
  intentId: string;
  amount: number;
  paymentChannel?: string;
  voucherNote?: string;
  voucherUrl?: string;
}) {
  return submitDepositForCurrentVisitor(input);
}

function ensureAdminApiToken(requestToken: string | null) {
  const expected = (process.env.ADMIN_API_TOKEN || "").trim();
  if (!expected) {
    throw new Error("管理接口未启用访问口令，当前拒绝访问。");
  }
  if ((requestToken || "").trim() !== expected) {
    throw new Error("无权限访问管理接口");
  }
}

export async function listIntentsForAdmin(input: {
  status?: string;
  sourceType?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
  adminToken?: string | null;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const limit = Math.max(1, Math.min(input.limit || 30, 200));
  const offset = Math.max(0, input.offset || 0);

  let query = supabase
    .from("intent_orders")
    .select(
      "id,project_id,user_id,source_type,status,priority,contact_name,contact_phone_or_wechat,operator_note,created_at,updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.status?.trim()) query = query.eq("status", ensureIntentStatus(input.status.trim()));
  if (input.sourceType?.trim()) query = query.eq("source_type", ensureSourceType(input.sourceType.trim()));
  if (input.keyword?.trim()) {
    const keyword = input.keyword.trim();
    query = query.or(`id.ilike.%${keyword}%,contact_phone_or_wechat.ilike.%${keyword}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`管理端意向单列表读取失败: ${error.message}`);

  const ids = (data || []).map((item) => item.id);
  let snapshotMap: Record<string, unknown> = {};
  if (ids.length > 0) {
    const { data: snapshots, error: snapshotError } = await supabase
      .from("intent_snapshots")
      .select("intent_id,project_title,estimated_total_price_min,estimated_total_price_max,created_at")
      .in("intent_id", ids)
      .order("created_at", { ascending: false });
    if (snapshotError) throw new Error(`管理端意向快照读取失败: ${snapshotError.message}`);
    const map: Record<string, unknown> = {};
    for (const row of snapshots || []) {
      if (!map[row.intent_id]) map[row.intent_id] = row;
    }
    snapshotMap = map;
  }

  return {
    items: (data || []).map((item) => ({ ...item, latest_snapshot: snapshotMap[item.id] || null })),
    total: count || 0,
    limit,
    offset,
    hasMore: offset + (data?.length || 0) < (count || 0)
  };
}

export async function getIntentDetailForAdmin(input: { intentId: string; adminToken?: string | null }) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("*")
    .eq("id", input.intentId)
    .maybeSingle();
  if (intentError) throw new Error(`管理端意向详情读取失败: ${intentError.message}`);
  if (!intentData) return null;

  const [{ data: snapshots, error: snapshotError }, { data: followups, error: followupError }, { data: quotes, error: quoteError }] =
    await Promise.all([
      supabase
        .from("intent_snapshots")
        .select("*")
        .eq("intent_id", input.intentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("intent_followups")
        .select("*")
        .eq("intent_id", input.intentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("quote_sheets")
        .select("*")
        .eq("intent_id", input.intentId)
        .order("version", { ascending: false })
    ]);

  if (snapshotError) throw new Error(`管理端意向快照读取失败: ${snapshotError.message}`);
  if (followupError) throw new Error(`管理端跟进读取失败: ${followupError.message}`);
  if (quoteError) throw new Error(`管理端报价读取失败: ${quoteError.message}`);

  return {
    intent: intentData,
    snapshots: snapshots || [],
    followups: followups || [],
    quotes: quotes || []
  };
}

export async function updateIntentStatusForAdmin(input: {
  intentId: string;
  toStatus: string;
  note?: string;
  adminToken?: string | null;
  actorId?: string;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const toStatus = ensureIntentStatus(input.toStatus.trim());

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,status")
    .eq("id", input.intentId)
    .maybeSingle();
  if (intentError) throw new Error(`意向单读取失败: ${intentError.message}`);
  if (!intentData) throw new Error("意向单不存在");

  const { error: updateError } = await supabase
    .from("intent_orders")
    .update({ status: toStatus })
    .eq("id", input.intentId);
  if (updateError) throw new Error(`意向单状态更新失败: ${updateError.message}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: input.intentId,
    action_type: "status_change",
    from_status: intentData.status,
    to_status: toStatus,
    content: (input.note || "").trim() || `状态更新为 ${toStatus}`,
    actor_id: input.actorId || "admin"
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return { intentId: input.intentId, fromStatus: intentData.status, toStatus };
}

export async function updateIntentShowcaseControlForAdmin(input: {
  intentId: string;
  control: Partial<ShowcaseDisplayControl>;
  adminToken?: string | null;
  actorId?: string;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,source_type,operator_note")
    .eq("id", input.intentId)
    .maybeSingle();

  if (intentError) throw new Error(`公开展示控制读取失败: ${intentError.message}`);
  if (!intentData) throw new Error("推进意向不存在");
  if (intentData.source_type !== "crowdfunding") throw new Error("只有公开展示路径可以调整展示控制");

  const currentControl = parseShowcaseDisplayControl(intentData.operator_note);
  const nextControl: ShowcaseDisplayControl = {
    featured: input.control.featured ?? currentControl.featured,
    homepage: input.control.homepage ?? currentControl.homepage,
    paused: input.control.paused ?? currentControl.paused
  };

  const operatorNote = upsertShowcaseDisplayControl(intentData.operator_note, nextControl);

  const { error: updateError } = await supabase
    .from("intent_orders")
    .update({ operator_note: operatorNote })
    .eq("id", input.intentId);

  if (updateError) throw new Error(`公开展示控制更新失败: ${updateError.message}`);

  const content = `公开展示控制已更新：${formatShowcaseDisplayControl(nextControl)}`;
  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: input.intentId,
    action_type: "showcase_control",
    content,
    actor_id: input.actorId || "admin"
  });

  if (followupError) throw new Error(`公开展示动态写入失败: ${followupError.message}`);

  return {
    intentId: input.intentId,
    control: nextControl,
    summary: formatShowcaseDisplayControl(nextControl)
  };
}

export async function appendIntentFollowupForAdmin(input: {
  intentId: string;
  actionType: string;
  content: string;
  adminToken?: string | null;
  actorId?: string;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();

  const actionType = (input.actionType || "").trim();
  if (!actionType) throw new Error("actionType 不能为空");
  const content = (input.content || "").trim();
  if (!content) throw new Error("content 不能为空");

  const { data, error } = await supabase
    .from("intent_followups")
    .insert({
      intent_id: input.intentId,
      action_type: actionType,
      content,
      actor_id: input.actorId || "admin"
    })
    .select("*")
    .single();
  if (error) throw new Error(`追加跟进失败: ${error.message}`);
  return data;
}

export async function createQuoteForIntentAdmin(input: {
  intentId: string;
  payload: CreateQuoteInput;
  adminToken?: string | null;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,status")
    .eq("id", input.intentId)
    .maybeSingle();
  if (intentError) throw new Error(`意向单读取失败: ${intentError.message}`);
  if (!intentData) throw new Error("意向单不存在");

  const { data: quoteRows, error: quoteListError } = await supabase
    .from("quote_sheets")
    .select("version")
    .eq("intent_id", input.intentId)
    .order("version", { ascending: false })
    .limit(1);
  if (quoteListError) throw new Error(`报价版本读取失败: ${quoteListError.message}`);

  const nextVersion = (quoteRows?.[0]?.version || 0) + 1;
  const payload = input.payload;

  const { data: quoteData, error: createError } = await supabase
    .from("quote_sheets")
    .insert({
      intent_id: input.intentId,
      version: nextVersion,
      quote_status: "draft",
      valid_until: payload.validUntil?.trim() || null,
      quantity: payload.quantity,
      package_level: payload.packageLevel,
      design_service_level: payload.designServiceLevel,
      final_unit_price: payload.finalUnitPrice,
      final_total_price: payload.finalTotalPrice,
      design_fee: payload.designFee || 0,
      discount_amount: payload.discountAmount || 0,
      deposit_amount: payload.depositAmount || 0,
      payment_mode: payload.paymentMode || "deposit",
      delivery_note: payload.deliveryNote?.trim() || null,
      production_note: payload.productionNote?.trim() || null,
      risk_note: payload.riskNote?.trim() || null,
      extra: payload.extra || {},
      confirmed_by: payload.confirmedBy?.trim() || null
    })
    .select("*")
    .single();
  if (createError || !quoteData) throw new Error(`报价单创建失败: ${createError?.message || "未知错误"}`);

  const { error: intentUpdateError } = await supabase
    .from("intent_orders")
    .update({ status: "quoted" })
    .eq("id", input.intentId);
  if (intentUpdateError) throw new Error(`意向单状态更新失败: ${intentUpdateError.message}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: input.intentId,
    action_type: "quote_created",
    from_status: intentData.status,
    to_status: "quoted",
    content: `已创建报价单 v${nextVersion}`,
    actor_id: payload.confirmedBy?.trim() || "admin"
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return quoteData;
}

export async function listQuotesForAdmin(input: {
  status?: string;
  intentId?: string;
  limit?: number;
  offset?: number;
  adminToken?: string | null;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const limit = Math.max(1, Math.min(input.limit || 30, 200));
  const offset = Math.max(0, input.offset || 0);

  let query = supabase
    .from("quote_sheets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.status?.trim()) query = query.eq("quote_status", ensureQuoteStatus(input.status.trim()));
  if (input.intentId?.trim()) query = query.eq("intent_id", input.intentId.trim());

  const { data, error, count } = await query;
  if (error) throw new Error(`报价单列表读取失败: ${error.message}`);

  return {
    items: data || [],
    total: count || 0,
    limit,
    offset,
    hasMore: offset + (data?.length || 0) < (count || 0)
  };
}

export async function updateQuoteStatusForAdmin(input: {
  quoteId: string;
  toStatus: string;
  note?: string;
  actorId?: string;
  adminToken?: string | null;
}) {
  ensureAdminApiToken(input.adminToken || null);
  const supabase = getSupabaseServerClient();
  const toStatus = ensureQuoteStatus(input.toStatus.trim());

  const { data: quoteData, error: quoteError } = await supabase
    .from("quote_sheets")
    .select("id,intent_id,quote_status")
    .eq("id", input.quoteId)
    .maybeSingle();
  if (quoteError) throw new Error(`报价单读取失败: ${quoteError.message}`);
  if (!quoteData) throw new Error("报价单不存在");

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,status")
    .eq("id", quoteData.intent_id)
    .maybeSingle();
  if (intentError) throw new Error(`意向单读取失败: ${intentError.message}`);
  if (!intentData) throw new Error("关联意向单不存在");

  const { error: updateError } = await supabase
    .from("quote_sheets")
    .update({ quote_status: toStatus })
    .eq("id", input.quoteId);
  if (updateError) throw new Error(`报价单状态更新失败: ${updateError.message}`);

  let nextIntentStatus: IntentStatus | null = null;
  if (toStatus === "accepted") {
    nextIntentStatus = "deposit_pending";
  } else if ((toStatus === "sent" || toStatus === "draft") && intentData.status !== "quoted") {
    nextIntentStatus = "quoted";
  }

  if (nextIntentStatus && nextIntentStatus !== intentData.status) {
    const { error: updateIntentError } = await supabase
      .from("intent_orders")
      .update({ status: nextIntentStatus })
      .eq("id", quoteData.intent_id);
    if (updateIntentError) throw new Error(`意向单状态同步失败: ${updateIntentError.message}`);
  }

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: quoteData.intent_id,
    action_type: "quote_status_change",
    from_status: intentData.status,
    to_status: nextIntentStatus || intentData.status,
    content:
      (input.note || "").trim() ||
      (nextIntentStatus && nextIntentStatus !== intentData.status
        ? `报价单状态更新为 ${toStatus}，意向阶段同步为 ${nextIntentStatus}`
        : `报价单状态更新为 ${toStatus}`),
    actor_id: input.actorId || "admin"
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return { quoteId: input.quoteId, fromStatus: quoteData.quote_status, toStatus };
}
