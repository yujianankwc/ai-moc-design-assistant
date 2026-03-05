import { cookies, headers } from "next/headers";
import { buildEditableVersion } from "@/lib/editable-version";
import { evaluateProductionScoreByRules } from "@/lib/production-score-rules";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { buildScopedDemoUser, normalizeVisitorId, VISITOR_COOKIE_NAME, VISITOR_HEADER_NAME } from "@/lib/visitor-id";
import { mockProjectResults } from "@/services/mock-project-results";
import { generateProjectOutputWithAI } from "@/services/ai-project-output";
import type { GenerationMode } from "@/types/generation-mode";
import type { ProjectDetailRow, ProjectFormPayload, ProjectRow, ProjectStatus } from "@/types/project";
import type { ProjectOutputRow } from "@/types/project-output";
import type { QuickEntryInput, QuickEntryResult } from "@/types/quick-entry";
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
  const cookieVisitorId = normalizeVisitorId(cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "");
  const visitorId = headerVisitorId || cookieVisitorId || "anonymous";
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
