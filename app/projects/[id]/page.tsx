import {
  DEFAULT_MOCK_PROJECT_ID,
  type MockProjectResult,
  mockProjectResultMap
} from "@/services/mock-project-results";
import Link from "next/link";
import {
  getProjectWithOutputById,
  RULE_DEDUCTION_MARKER,
  SYSTEM_FALLBACK_MARKER
} from "@/services/project-service";
import { parseEditableVersion } from "@/lib/editable-version";
import {
  formatIntentFollowupSummary,
  getIntentStatusExplanation,
  getStageExplanation,
  inferJudgementFromProjectSnapshot,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapProjectCategoryToPathLabel,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { buildQuickPathHref } from "@/lib/quick-path-context";
import {
  mapCategory
} from "@/lib/display-mappers";

type ProjectResultPageProps = {
  params: Promise<{ id: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function splitTextToList(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(
      (item) =>
        Boolean(item) &&
        !item.startsWith(SYSTEM_FALLBACK_MARKER) &&
        !item.startsWith(RULE_DEDUCTION_MARKER)
    );
}

function extractRuleDeductions(value: string | null | undefined) {
  if (!value) return [];
  const markerLine = value
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.startsWith(RULE_DEDUCTION_MARKER));
  if (!markerLine) return [];

  return markerLine
    .slice(RULE_DEDUCTION_MARKER.length)
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function composeResultFromDb(params: {
  id: string;
  project: {
    title: string | null;
    category: string | null;
    style: string | null;
    size_target: string | null;
    audience: string | null;
  };
  output: {
    design_summary: string | null;
    design_positioning: string | null;
    build_difficulty: string | null;
    structure_notes: string | null;
    highlight_points: string[] | null;
    bom_groups: Array<{ item: string; estimate: string; note: string }> | null;
    risk_notes: string | null;
    substitution_suggestions: string | null;
    production_hint: string | null;
    production_score: number;
    recommended_next_step: string | null;
    recommended_service: string | null;
    internal_recommendation: string | null;
    editable_version: unknown;
  };
}): MockProjectResult {
  const designBrief = [
    params.output.design_summary,
    params.output.design_positioning,
    params.output.structure_notes,
    ...(params.output.highlight_points ?? [])
  ].filter(Boolean) as string[];

  const manufacturabilityTips = [
    ...splitTextToList(params.output.substitution_suggestions),
    ...splitTextToList(params.output.production_hint)
  ];
  const parsedEditable = parseEditableVersion(params.output.editable_version);
  const scoreDeductions = extractRuleDeductions(params.output.production_hint);

  return {
    id: params.id,
    projectTitle: params.project.title || "未命名项目",
    category: params.project.category || "未填写",
    style: params.project.style || "未填写",
    sizeTarget: params.project.size_target || "未填写",
    audience: params.project.audience || "未填写",
    buildDifficulty: params.output.build_difficulty || "中等",
    scenarioTag: params.output.recommended_next_step || "已生成当前方向建议",
    production_score: params.output.production_score,
    designBrief: designBrief.length > 0 ? designBrief : ["暂无设计简报内容"],
    bomDraft:
      params.output.bom_groups && params.output.bom_groups.length > 0
        ? params.output.bom_groups
        : [{ item: "暂无零件分组", estimate: "-", note: "预估零件方案待补充" }],
    risks: splitTextToList(params.output.risk_notes),
    manufacturabilityTips:
      manufacturabilityTips.length > 0 ? manufacturabilityTips : ["暂无可生产性建议"],
    scoreDeductions,
    manualEditDraft: parsedEditable.manual_edit_content,
    collaborationAdvice: splitTextToList(params.output.internal_recommendation)
  };
}

function getMainRecommendation(productionScore: number) {
  if (productionScore >= 80) {
    return "先把这个方向补充完整";
  }
  if (productionScore >= 60) {
    return "去看试做路径";
  }
  if (productionScore >= 40) {
    return "去看试做路径";
  }
  return "先把这个方向补充完整";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function formatProjectCommercialSignal(input: {
  currentIntentStatus?: string | null;
  latestQuoteStatus?: string | null;
  latestQuoteVersion?: number | null;
  stage: string;
}) {
  let signal = "当前更适合继续看清方向，再决定要不要投入更多资源。";
  const isDeliveryPhase =
    input.currentIntentStatus === "locked" ||
    input.currentIntentStatus === "preparing_delivery" ||
    input.currentIntentStatus === "delivering" ||
    input.currentIntentStatus === "delivered" ||
    input.currentIntentStatus === "closed_won";

  if (input.stage === "公开展示中") {
    signal = "当前以公开展示和收集关注为主。";
  }

  if (input.currentIntentStatus === "locked") {
    signal = "已经进入锁单推进，正在继续确认交付安排。";
  } else if (input.currentIntentStatus === "preparing_delivery") {
    signal = "已经开始准备交付安排。";
  } else if (input.currentIntentStatus === "delivering") {
    signal = "正在继续跟进交付进度。";
  } else if (input.currentIntentStatus === "delivered" || input.currentIntentStatus === "closed_won") {
    signal = "这条方向已经完成交付。";
  }

  if (!isDeliveryPhase && input.latestQuoteStatus === "draft") {
    signal = "正在整理最新报价说明。";
  } else if (!isDeliveryPhase && input.latestQuoteStatus === "sent") {
    signal = "已经给出一版报价说明。";
  } else if (!isDeliveryPhase && input.latestQuoteStatus === "accepted") {
    signal = "这版报价说明已经确认。";
  } else if (!isDeliveryPhase && input.latestQuoteStatus === "replaced") {
    signal = "这条方向已经更新过报价说明。";
  }

  if (input.latestQuoteVersion) {
    return `${signal} 最新报价 v${input.latestQuoteVersion}`;
  }

  return signal;
}

function scoreIntentProgress(input: { sourceType: string; status: string; updatedAt: string }) {
  let score = 0;
  if (input.sourceType === "crowdfunding") score += 5;
  if (input.status === "delivered" || input.status === "closed_won") score += 52;
  else if (input.status === "delivering") score += 48;
  else if (input.status === "preparing_delivery") score += 44;
  else if (input.status === "locked") score += 40;
  else if (input.status === "deposit_pending") score += 30;
  else if (input.status === "quoted") score += 25;
  else if (input.status === "confirming" || input.status === "contacted") score += 18;
  else score += 10;
  return score + new Date(input.updatedAt).getTime() / 1_000_000_000_000;
}

export default async function ProjectResultPage({ params }: ProjectResultPageProps) {
  const { id } = await params;
  let result: MockProjectResult | undefined;
  let fromRealProject = false;
  let usedFallbackOutput = false;
  let usedAiFallbackOutput = false;
  let projectStatusRaw: string | null = null;
  let realProjectId: string | null = null;
  let allLinkedIntents: Array<{
    id: string;
    source_type: string;
    status: string;
    updated_at: string;
    latest_quote_status?: string | null;
    latest_quote_version?: number | null;
    latest_followup?: {
      id: string;
      action_type: string | null;
      content: string | null;
      from_status?: string | null;
      to_status?: string | null;
      created_at: string;
    } | null;
  }> = [];
  let linkedIntent: {
    id: string;
    source_type: string;
    status: string;
    updated_at: string;
    latest_quote_status?: string | null;
    latest_quote_version?: number | null;
    recent_followups?: Array<{
      id: string;
      action_type: string | null;
      content: string | null;
      from_status?: string | null;
      to_status?: string | null;
      created_at: string;
    }>;
  } | null = null;

  if (isUuid(id)) {
    try {
      const dbDetail = await getProjectWithOutputById(id);

      if (dbDetail?.project && dbDetail.output) {
        projectStatusRaw = dbDetail.project.status;
        linkedIntent = dbDetail.project.linked_intent ?? null;
        allLinkedIntents = dbDetail.project.all_linked_intents ?? [];
        usedAiFallbackOutput = Boolean(
          dbDetail.output.internal_recommendation?.includes(SYSTEM_FALLBACK_MARKER)
        );
        result = composeResultFromDb({
          id,
          project: dbDetail.project,
          output: dbDetail.output
        });
        fromRealProject = true;
        realProjectId = id;
      } else if (dbDetail?.project && !dbDetail.output) {
        projectStatusRaw = dbDetail.project.status;
        linkedIntent = dbDetail.project.linked_intent ?? null;
        allLinkedIntents = dbDetail.project.all_linked_intents ?? [];
        const fallback = mockProjectResultMap[DEFAULT_MOCK_PROJECT_ID];
        if (fallback) {
          result = {
            ...fallback,
            id,
            projectTitle: dbDetail.project.title || fallback.projectTitle,
            category: dbDetail.project.category || fallback.category,
            style: dbDetail.project.style || fallback.style,
            sizeTarget: dbDetail.project.size_target || fallback.sizeTarget,
            audience: dbDetail.project.audience || fallback.audience
          };
          fromRealProject = true;
          usedFallbackOutput = true;
          realProjectId = id;
        }
      }
    } catch {
      result = undefined;
    }
  }

  if (!result) {
    result = mockProjectResultMap[id] ?? mockProjectResultMap[DEFAULT_MOCK_PROJECT_ID];
  }

  if (!result) return null;

  const mainRecommendation = getMainRecommendation(result.production_score);
  const unifiedStage = mapProjectWithIntentToUnifiedStage({
    projectStatus: projectStatusRaw,
    intentStatus: linkedIntent?.status,
    intentSourceType: linkedIntent?.source_type
  });
  const pathLabel = linkedIntent ? mapIntentSourceTypeToPathLabel(linkedIntent.source_type) : mapProjectCategoryToPathLabel(result.category);
  const projectJudgement = inferJudgementFromProjectSnapshot({
    category: result.category,
    style: result.style,
    audience: result.audience,
    designBrief: result.designBrief,
    recommendation: mainRecommendation
  });
  const nextSuggestion = linkedIntent
    ? inferIntentNextSuggestion({ sourceType: linkedIntent.source_type, status: linkedIntent.status })
    : formatNextSuggestionLabel(inferNextSuggestionFromJudgement(projectJudgement));
  const stageExplanation = linkedIntent
    ? getIntentStatusExplanation({ status: linkedIntent.status, sourceType: linkedIntent.source_type })
    : getStageExplanation(unifiedStage, pathLabel);
  const linkedIntentJudgement = linkedIntent ? mapIntentSourceTypeToJudgement(linkedIntent.source_type) : null;
  const projectCommercialSignal = formatProjectCommercialSignal({
    currentIntentStatus: linkedIntent?.status,
    latestQuoteStatus: linkedIntent?.latest_quote_status,
    latestQuoteVersion: linkedIntent?.latest_quote_version,
    stage: unifiedStage
  });
  const designBriefSummary = result.designBrief[0] ?? "暂无设计简报总述。";
  const projectTimeline = [...allLinkedIntents]
    .map((item) => ({
      id: item.latest_followup?.id || item.id,
      createdAt: item.latest_followup?.created_at || item.updated_at,
      summary: formatIntentFollowupSummary({
        actionType: item.latest_followup?.action_type,
        content: item.latest_followup?.content,
        fromStatus: item.latest_followup?.from_status,
        toStatus: item.latest_followup?.to_status
      }),
      pathLabel: mapIntentSourceTypeToPathLabel(item.source_type)
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const recommendedPath = [...allLinkedIntents]
    .sort(
      (a, b) =>
        scoreIntentProgress({ sourceType: b.source_type, status: b.status, updatedAt: b.updated_at }) -
        scoreIntentProgress({ sourceType: a.source_type, status: a.status, updatedAt: a.updated_at })
    )[0] || null;
  const projectQuickContext = {
    projectId: realProjectId || "",
    idea: result.projectTitle,
    direction: "",
    style: "",
    scale: "",
    referenceImage: "",
    quickJudgement: linkedIntentJudgement || projectJudgement,
    quickPath: ""
  } as const;
  const primaryAction =
    linkedIntent?.source_type === "crowdfunding"
      ? { href: `/intents/${linkedIntent.id}`, label: "继续发布出来看看" }
      : nextSuggestion.includes("试做")
        ? { href: buildQuickPathHref("small_batch", projectQuickContext), label: "先下单试做" }
        : { href: buildQuickPathHref("professional_upgrade", projectQuickContext), label: "先把这个方向补完整" };

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            现在到哪一步了 · {unifiedStage}
          </span>
          <span className="inline-flex rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            现在主要这样玩 · {pathLabel}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{result.projectTitle}</h1>
        <p className="text-sm text-slate-600">{stageExplanation}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">这是什么方向</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{linkedIntentJudgement || projectJudgement}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">下一步最适合</p>
            <p className="mt-1 text-sm font-bold text-amber-700">{nextSuggestion}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href={primaryAction.href} className="primary-cta px-4 py-2.5">
            {primaryAction.label}
          </Link>
          <Link href="/projects" className="secondary-cta px-4 py-2.5">
            回到我的
          </Link>
        </div>
      </div>
      {!fromRealProject && !mockProjectResultMap[id] && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前项目结果还在整理中，这里先给你一版可继续判断方向的参考结果。
        </div>
      )}
      {fromRealProject && usedFallbackOutput && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前项目已读取到基础信息，这里先展示一版参考结果，方便继续判断推进路径。
        </div>
      )}
      {fromRealProject && usedAiFallbackOutput && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          AI 这次没有完整补出方案，这里先保留一版可继续判断的结果，你也可以稍后重新整理。
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">这条方向现在是什么情况</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">现在到哪一步</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{unifiedStage}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">现在主要这样玩</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{pathLabel}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">更像什么方向</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{mapCategory(result.category)}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-700">{projectCommercialSignal}</p>
        {allLinkedIntents.length > 1 && (
          <div className="mt-4 rounded-xl bg-blue-50/70 p-4">
            <p className="text-xs font-bold text-blue-500">多条路径时先看什么</p>
            <p className="mt-2 text-sm text-blue-900">
              当前先围绕 {recommendedPath ? mapIntentSourceTypeToPathLabel(recommendedPath.source_type) : pathLabel} 继续收敛，再决定其它路径是否继续保留。
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">下一步点哪个按钮</h2>
        <p className="mt-2 text-sm text-slate-700">{designBriefSummary}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={primaryAction.href} className="primary-cta px-4 py-2.5">
            {primaryAction.label}
          </Link>
          {!linkedIntent || linkedIntent.source_type !== "crowdfunding" ? (
            <Link href={buildQuickPathHref("creator_plan", projectQuickContext)} className="secondary-cta px-4 py-2.5">
              发布出来看看
            </Link>
          ) : null}
          <Link href="/showcase" className="secondary-cta px-4 py-2.5">
            看别人怎么玩
          </Link>
        </div>
      </section>

      {linkedIntent?.recent_followups && linkedIntent.recent_followups.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">最近发生了什么</h2>
          <div className="mt-3 space-y-3">
            {linkedIntent.recent_followups.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {formatIntentFollowupSummary({
                      actionType: item.action_type,
                      content: item.content,
                      fromStatus: item.from_status,
                      toStatus: item.to_status
                    })}
                  </p>
                  <span className="text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : projectTimeline.length > 1 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">最近发生了什么</h2>
          <div className="mt-3 space-y-3">
            {projectTimeline.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.summary}</p>
                  <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">如果你还想继续玩</h2>
        <p className="mt-2 text-sm text-slate-600">当前最推荐：{nextSuggestion}。如果你还想试别的，再点下面这些按钮。</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={buildQuickPathHref("small_batch", projectQuickContext)}
            className="secondary-cta px-4 py-2.5"
          >
            先下单试做
          </Link>
          <Link
            href={buildQuickPathHref("professional_upgrade", projectQuickContext)}
            className="secondary-cta px-4 py-2.5"
          >
            先把这个方向补完整
          </Link>
          {realProjectId && (!linkedIntent || linkedIntent.source_type !== "crowdfunding") && (
            <Link
              href={buildQuickPathHref("creator_plan", projectQuickContext)}
              className="secondary-cta px-4 py-2.5"
            >
              发布出来看看
            </Link>
          )}
        </div>
      </section>
    </section>
  );
}
