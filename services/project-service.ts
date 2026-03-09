import { cookies, headers } from "next/headers";
import { buildEditableVersion } from "@/lib/editable-version";
import { evaluateProductionScoreByRules } from "@/lib/production-score-rules";
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
import type { QuickEntryInput, QuickEntryResult } from "@/types/quick-entry";
import type {
  CreateIntentInput,
  CreateQuoteInput,
  IntentSourceType,
  IntentStatus,
  QuoteStatus
} from "@/types/intent";
import type { CreateServiceRequestInput } from "@/types/service-request";

export const SYSTEM_FALLBACK_MARKER = "__SYSTEM_FALLBACK__:";
export const RULE_DEDUCTION_MARKER = "__RULE_DEDUCTIONS__:";
export const QUICK_PROJECT_DATA_MARKER = "__QUICK_PROJECT_DATA__:";

export function quickProjectHasImage(notesForFactory: string | null | undefined): boolean {
  if (!notesForFactory || !notesForFactory.startsWith(QUICK_PROJECT_DATA_MARKER)) return false;
  try {
    const json = notesForFactory.slice(QUICK_PROJECT_DATA_MARKER.length);
    const parsed = JSON.parse(json) as { previewImageUrl?: string | null };
    return Boolean(parsed?.previewImageUrl);
  } catch {
    return false;
  }
}

type QuickProjectData = {
  input: QuickEntryInput;
  result: QuickEntryResult;
  textWarning?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
};

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
    return parsed;
  } catch {
    return null;
  }
}

export async function ensureDemoUser() {
  const supabase = getSupabaseServerClient();
  const headerStore = await headers();
  const cookieStore = await cookies();
  const headerVisitorId = normalizeVisitorId(headerStore.get(VISITOR_HEADER_NAME) ?? "");
  const cookieVisitorId = await resolveVisitorIdFromToken(cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "");
  const visitorId = headerVisitorId || cookieVisitorId;
  if (!visitorId) {
    throw new Error("访客会话无效，请刷新页面后重试。");
  }
  const demoUser = buildScopedDemoUser(visitorId);

  const { error } = await supabase.from("users").upsert(
    {
      id: demoUser.id,
      email: demoUser.email,
      name: demoUser.name
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`演示用户初始化失败: ${error.message}`);
  }

  return demoUser;
}

export async function createProjectForDemoUser(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: demoUser.id,
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
      warning = "AI 生成暂时失败，当前为自动回退结果，建议稍后重新生成。";
    } catch {
      await updateProjectStatus(input.projectId, "failed");
      throw new Error("项目方案生成失败，请稍后重试。");
    }
  }

  return { usedFallbackOutput, warning };
}

export async function createProjectAndMaybeOutputForDemoUser(input: {
  status: ProjectStatus;
  payload: ProjectFormPayload;
}) {
  const createdProject = await createProjectForDemoUser(input);
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

export async function regenerateProjectOutputForDemoUser(projectId: string) {
  return regenerateProjectOutputByModeForDemoUser({ projectId });
}

export async function regenerateProjectOutputByModeForDemoUser(input: {
  projectId: string;
  mode?: GenerationMode;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select(
      "id,user_id,title,category,style,size_target,size_note,audience,description,must_have_elements,avoid_elements,build_goal,collaboration_goal,willing_creator_plan,willing_sampling,reference_links,notes_for_factory"
    )
    .eq("id", input.projectId)
    .eq("user_id", demoUser.id)
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

export async function listProjectsByDemoUser() {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,title,status,updated_at,category,notes_for_factory")
    .eq("user_id", demoUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`项目读取失败: ${error.message}`);
  }

  return (data ?? []) as ProjectRow[];
}

export async function createQuickProjectForDemoUser(input: {
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();
  const title = normalizeQuickProjectTitle({
    conceptTitle: input.quickResult.conceptTitle,
    rawIdea: input.quickInput.idea
  });

  const quickData: QuickProjectData = {
    input: input.quickInput,
    result: input.quickResult,
    textWarning: input.textWarning ?? "",
    previewImageUrl: null,
    imageWarning: ""
  };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: demoUser.id,
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

export async function updateQuickProjectResultForDemoUser(input: {
  projectId: string;
  quickInput: QuickEntryInput;
  quickResult: QuickEntryResult;
  textWarning?: string;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();
  const title = normalizeQuickProjectTitle({
    conceptTitle: input.quickResult.conceptTitle,
    rawIdea: input.quickInput.idea
  });

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,category,notes_for_factory")
    .eq("id", input.projectId)
    .eq("user_id", demoUser.id)
    .eq("category", "quick_entry")
    .maybeSingle();

  if (error) {
    throw new Error(`轻量项目读取失败: ${error.message}`);
  }
  if (!data) {
    throw new Error("未找到轻量项目，无法更新结果。");
  }

  const previous = decodeQuickProjectData(data.notes_for_factory);
  const nextData: QuickProjectData = {
    input: input.quickInput,
    result: input.quickResult,
    textWarning: input.textWarning ?? "",
    previewImageUrl: previous?.previewImageUrl ?? null,
    imageWarning: previous?.imageWarning ?? ""
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
    .eq("user_id", demoUser.id);

  if (updateError) {
    throw new Error(`轻量项目结果更新失败: ${updateError.message}`);
  }

  return { id: input.projectId };
}

export async function getQuickProjectByIdForDemoUser(projectId: string) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,title,status,updated_at,category,notes_for_factory")
    .eq("id", projectId)
    .eq("user_id", demoUser.id)
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
    textWarning: quickData.textWarning ?? ""
  };
}

export async function updateQuickProjectImageForDemoUser(input: {
  projectId: string;
  idea?: string;
  previewImageUrl?: string | null;
  imageWarning?: string;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data, error } = await supabase
    .from("projects")
    .select("id,user_id,category,notes_for_factory")
    .eq("id", input.projectId)
    .eq("user_id", demoUser.id)
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

  const nextData: QuickProjectData = {
    ...quickData,
    previewImageUrl:
      typeof input.previewImageUrl === "string" ? input.previewImageUrl : input.previewImageUrl === null ? null : quickData.previewImageUrl ?? null,
    imageWarning: input.imageWarning ?? quickData.imageWarning ?? ""
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({ notes_for_factory: encodeQuickProjectData(nextData) })
    .eq("id", input.projectId)
    .eq("user_id", demoUser.id);

  if (updateError) {
    throw new Error(`轻量项目预览图更新失败: ${updateError.message}`);
  }
}

export async function getProjectWithOutputById(projectId: string) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id,title,category,style,size_target,audience,status,updated_at")
    .eq("id", projectId)
    .eq("user_id", demoUser.id)
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

  return {
    project: projectData as ProjectDetailRow,
    output: (outputData as ProjectOutputRow | null) ?? null
  };
}

export async function createServiceRequestForDemoUser(input: CreateServiceRequestInput) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      project_id: input.projectId,
      user_id: demoUser.id,
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

export async function updateManualEditForDemoUser(input: {
  projectId: string;
  manualEditContent: string;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id,user_id")
    .eq("id", input.projectId)
    .eq("user_id", demoUser.id)
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

const VALID_INTENT_STATUSES: IntentStatus[] = [
  "new",
  "contact_pending",
  "contacted",
  "confirming",
  "quoted",
  "deposit_pending",
  "locked",
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

export async function createIntentForDemoUser(input: CreateIntentInput) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  if (!input.contactPhoneOrWechat?.trim()) {
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
      .eq("user_id", demoUser.id)
      .maybeSingle();
    if (projectError) throw new Error(`项目校验失败: ${projectError.message}`);
    if (!projectData) throw new Error("项目不存在或无权限创建该意向单");
  }

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .insert({
      project_id: input.projectId?.trim() || null,
      user_id: demoUser.id,
      source_type: ensureSourceType(input.sourceType),
      status: "new",
      priority: "normal",
      contact_name: input.contactName?.trim() || null,
      contact_phone_or_wechat: input.contactPhoneOrWechat.trim(),
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
    ui_context: snapshotPayload.uiContext ?? {}
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

export async function listIntentsForDemoUser(input?: { limit?: number; offset?: number; status?: string }) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();
  const limit = Math.max(1, Math.min(input?.limit || 20, 100));
  const offset = Math.max(0, input?.offset || 0);

  let query = supabase
    .from("intent_orders")
    .select("id,project_id,source_type,status,priority,contact_phone_or_wechat,created_at,updated_at", {
      count: "exact"
    })
    .eq("user_id", demoUser.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input?.status?.trim()) {
    query = query.eq("status", ensureIntentStatus(input.status.trim()));
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`意向单列表读取失败: ${error.message}`);

  const ids = (data || []).map((item) => item.id);
  let snapshotMap: Record<string, unknown> = {};
  if (ids.length > 0) {
    const { data: snapshots, error: snapshotError } = await supabase
      .from("intent_snapshots")
      .select("intent_id,project_title,estimated_total_price_min,estimated_total_price_max,created_at")
      .in("intent_id", ids)
      .order("created_at", { ascending: false });
    if (snapshotError) throw new Error(`意向快照列表读取失败: ${snapshotError.message}`);
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

export async function getIntentDetailForDemoUser(intentId: string) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("*")
    .eq("id", intentId)
    .eq("user_id", demoUser.id)
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

export async function acceptQuoteForDemoUser(input: { quoteId: string }) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

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
    .eq("user_id", demoUser.id)
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
    actor_id: demoUser.id
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return { quoteId: input.quoteId, intentId: intentData.id };
}

export async function submitDepositForDemoUser(input: {
  intentId: string;
  amount: number;
  paymentChannel?: string;
  voucherNote?: string;
  voucherUrl?: string;
}) {
  const supabase = getSupabaseServerClient();
  const demoUser = await ensureDemoUser();

  const { data: intentData, error: intentError } = await supabase
    .from("intent_orders")
    .select("id,user_id,status")
    .eq("id", input.intentId)
    .eq("user_id", demoUser.id)
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
    actor_id: demoUser.id
  });
  if (followupError) throw new Error(`定金记录写入失败: ${followupError.message}`);

  return { intentId: input.intentId, fromStatus: "deposit_pending", toStatus: "locked" as const };
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

  const { error: updateError } = await supabase
    .from("quote_sheets")
    .update({ quote_status: toStatus })
    .eq("id", input.quoteId);
  if (updateError) throw new Error(`报价单状态更新失败: ${updateError.message}`);

  const { error: followupError } = await supabase.from("intent_followups").insert({
    intent_id: quoteData.intent_id,
    action_type: "quote_status_change",
    content: (input.note || "").trim() || `报价单状态更新为 ${toStatus}`,
    actor_id: input.actorId || "admin"
  });
  if (followupError) throw new Error(`跟进记录写入失败: ${followupError.message}`);

  return { quoteId: input.quoteId, fromStatus: quoteData.quote_status, toStatus };
}
