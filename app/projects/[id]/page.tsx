import {
  DEFAULT_MOCK_PROJECT_ID,
  type MockProjectResult,
  mockProjectResultMap
} from "@/services/mock-project-results";
import Link from "next/link";
import ServiceRequestModals from "@/components/service-request-modals";
import RegenerateProjectButton from "@/components/regenerate-project-button";
import ManualEditSection from "@/components/manual-edit-section";
import ResultDiffSummary from "@/components/result-diff-summary";
import {
  getProjectWithOutputById,
  RULE_DEDUCTION_MARKER,
  SYSTEM_FALLBACK_MARKER
} from "@/services/project-service";
import { parseEditableVersion } from "@/lib/editable-version";
import { buildKeyUpgradeSuggestions } from "@/lib/key-upgrade-suggestions";
import { buildCreativeProfileOverview } from "@/lib/creative-profile-v1";
import { pickSimilarReferences } from "@/lib/reference-matcher";
import { toResultDiffSnapshot } from "@/lib/result-diff";
import {
  formatNextSuggestionLabel,
  getStageExplanation,
  inferFitForFromJudgement,
  inferJudgementFromProjectSnapshot,
  inferNextSuggestionFromJudgement,
  mapProjectCategoryToPathLabel,
  mapProjectStatusToUnifiedStage,
  PROJECT_STAGE_LABELS
} from "@/lib/project-language";
import {
  mapAudience,
  mapBuildDifficulty,
  mapCategory,
  mapSizeTarget,
  mapStyle
} from "@/lib/display-mappers";
import type { ProjectBriefExportData } from "@/lib/brief-export";

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

function buildResultJudgementSentence(input: {
  overallSummary: string;
  recommendation: string;
  sizeTarget: string;
}) {
  const summary = input.overallSummary.trim();
  const trimmed = summary.endsWith("。") ? summary.slice(0, -1) : summary;
  return `${trimmed} 当前更适合按「${input.recommendation}」路径推进（目标体量：${input.sizeTarget}）。`;
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
    scenarioTag: params.output.recommended_next_step || "已生成占位结果",
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

function getRecommendationReasonText(recommendation: string) {
  if (recommendation === "去看试做路径") {
    return "当前更需要先验证结构与装配可行性，再决定是否继续补充完整方案。";
  }
  return "当前信息仍偏前期，先把方向、结构和关键约束补完整，再继续推进会更稳。";
}

export default async function ProjectResultPage({ params }: ProjectResultPageProps) {
  const { id } = await params;
  let result: MockProjectResult | undefined;
  let fromRealProject = false;
  let usedFallbackOutput = false;
  let usedAiFallbackOutput = false;
  let projectStatusRaw: string | null = null;
  let realProjectId: string | null = null;
  let updatedAtText = "演示数据";

  if (isUuid(id)) {
    try {
      const dbDetail = await getProjectWithOutputById(id);

      if (dbDetail?.project && dbDetail.output) {
        projectStatusRaw = dbDetail.project.status;
        updatedAtText = new Date(dbDetail.project.updated_at).toLocaleString("zh-CN");
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
        updatedAtText = new Date(dbDetail.project.updated_at).toLocaleString("zh-CN");
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
  const unifiedStage = mapProjectStatusToUnifiedStage(projectStatusRaw);
  const pathLabel = mapProjectCategoryToPathLabel(result.category);
  const projectJudgement = inferJudgementFromProjectSnapshot({
    category: result.category,
    style: result.style,
    audience: result.audience,
    designBrief: result.designBrief,
    recommendation: mainRecommendation
  });
  const fitForText = inferFitForFromJudgement(projectJudgement);
  const nextSuggestion = formatNextSuggestionLabel(inferNextSuggestionFromJudgement(projectJudgement));
  const stageExplanation = getStageExplanation(unifiedStage, pathLabel);
  const exportData: ProjectBriefExportData = {
    projectName: result.projectTitle,
    projectId: result.id,
    statusLabel: unifiedStage,
    categoryLabel: mapCategory(result.category),
    styleLabel: mapStyle(result.style),
    sizeTargetLabel: mapSizeTarget(result.sizeTarget),
    audienceLabel: mapAudience(result.audience),
    designBrief: result.designBrief,
    bomDraft: result.bomDraft,
    risks: result.risks,
    productionScore: result.production_score,
    buildDifficultyLabel: mapBuildDifficulty(result.buildDifficulty),
    recommendation: mainRecommendation,
    manufacturabilityTips: result.manufacturabilityTips,
    collaborationAdvice: result.collaborationAdvice,
    manualEditContent: result.manualEditDraft,
    updatedAtText,
    isFallbackResult: usedAiFallbackOutput || usedFallbackOutput
  };
  const currentDiffSnapshot = toResultDiffSnapshot({
    productionScore: result.production_score,
    recommendedNextStep: result.scenarioTag,
    recommendedService: mainRecommendation,
    bomGroups: result.bomDraft.map((item) => ({
      item: item.item,
      estimate: item.estimate
    })),
    riskCount: result.risks.length
  });
  const keyUpgradeSuggestions = buildKeyUpgradeSuggestions({
    productionScore: result.production_score,
    keyDeductions: result.scoreDeductions ?? [],
    bomGroups: result.bomDraft,
    riskNotes: result.risks,
    recommendedNextStep: result.scenarioTag,
    generationMode: undefined
  });
  const actionSuggestions = keyUpgradeSuggestions.slice(0, 2);
  const creativeProfile = buildCreativeProfileOverview({
    category: result.category,
    style: result.style,
    sizeTarget: result.sizeTarget,
    audience: result.audience,
    designBrief: result.designBrief,
    bomDraft: result.bomDraft,
    risks: result.risks,
    keyDeductions: result.scoreDeductions ?? [],
    productionScore: result.production_score,
    recommendation: mainRecommendation
  });
  const similarReferences = pickSimilarReferences({
    category: result.category,
    style: result.style,
    sizeTarget: result.sizeTarget,
    audience: result.audience,
    designBrief: result.designBrief,
    bomDraft: result.bomDraft,
    risks: result.risks,
    recommendedNextStep: result.scenarioTag,
    generationMode: undefined
  });
  const designBriefSummary = result.designBrief[0] ?? "暂无设计简报总述。";
  const designBriefHighlights = result.designBrief.slice(1, 4);
  const resultJudgement = buildResultJudgementSentence({
    overallSummary: creativeProfile.overallSummary,
    recommendation: mainRecommendation,
    sizeTarget: mapSizeTarget(result.sizeTarget)
  });
  const recommendationReasonText = getRecommendationReasonText(mainRecommendation);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            当前状态 · {unifiedStage}
          </span>
          <span className="inline-flex rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            当前路径 · {pathLabel}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{result.projectTitle}</h1>
        <p className="text-sm text-slate-600">{stageExplanation}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">当前判断</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{projectJudgement}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">当前更适合</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{fitForText}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-400">当前建议</p>
            <p className="mt-1 text-sm font-bold text-amber-700">{nextSuggestion}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {PROJECT_STAGE_LABELS.map((step) => {
            const active = PROJECT_STAGE_LABELS.indexOf(step) <= PROJECT_STAGE_LABELS.indexOf(unifiedStage);
            return (
              <p
                key={step}
                className={
                  active
                    ? "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
                    : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                }
              >
                {step}
              </p>
            );
          })}
        </div>
      </div>
      {!fromRealProject && !mockProjectResultMap[id] && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前项目还没有真实方案内容，这里先给你一版演示方案，方便继续判断怎么推进。
        </div>
      )}
      {fromRealProject && usedFallbackOutput && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前项目已读取真实基础信息，这里先用占位方案帮助你继续判断路径。
        </div>
      )}
      {fromRealProject && usedAiFallbackOutput && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          AI 这次没有顺利补完方案，这里先展示一版自动回退内容，方便你继续看方向判断。
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">项目概览</h2>
        {realProjectId && (
          <div className="mt-3">
            <RegenerateProjectButton
              projectId={realProjectId}
              currentSnapshot={currentDiffSnapshot}
            />
          </div>
        )}
        <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p className="break-all">项目 ID：{result.id}</p>
          <p>项目名称：{result.projectTitle}</p>
          <p>当前状态：{unifiedStage}</p>
          <p>作品类型：{mapCategory(result.category)}</p>
          <p>风格方向：{mapStyle(result.style)}</p>
          <p>目标体量：{mapSizeTarget(result.sizeTarget)}</p>
          <p>目标受众：{mapAudience(result.audience)}</p>
        </div>
      </section>

      {realProjectId && (
        <ResultDiffSummary projectId={realProjectId} currentSnapshot={currentDiffSnapshot} />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">当前判断</h2>
        <p className="mt-2 text-sm text-slate-700">{resultJudgement}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">判断补充</h2>
        <p className="mt-2 text-sm text-slate-700">{designBriefSummary}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {designBriefHighlights.length > 0 ? (
            designBriefHighlights.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>暂无更多关键亮点。</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">当前更适合</h2>
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {fitForText}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          用来补充这条方向当前更适合怎么走，避免把它看成静态档案。
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {creativeProfile.items.map((item) => (
            <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                  {item.levelLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">相似方向参考</h2>
        <p className="mt-2 text-xs text-slate-500">
          以下参考用于启发同类方向与落地思路，不代表唯一标准答案。
        </p>
        <div className="mt-3 space-y-3">
          {similarReferences.map((reference) => (
            <div key={reference.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{reference.title}</p>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                  {reference.referenceType === "moc"
                    ? "MOC（创意启发）"
                    : reference.referenceType === "official_set"
                      ? "官方套装（成熟逻辑）"
                      : "高砖方向（落地参考）"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">为什么相关：{reference.whyRelevant}</p>
              <p className="mt-1 text-sm text-slate-700">可借鉴点：{reference.takeaway}</p>
              <p className="mt-1 text-xs text-slate-500">来源：{reference.sourceLabel}</p>
              {reference.link && (
                <a
                  href={reference.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline"
                >
                  查看参考
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">结构与零件草案</h2>
        <p className="mt-2 text-sm text-slate-600">
          用于前期判断与打样前规划，不作为最终生产清单。
        </p>
        <div className="mt-3 space-y-3">
          {result.bomDraft.map((item) => (
            <div key={item.item} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{item.item}</p>
              <p className="mt-1 text-slate-700">预估数量：{item.estimate}</p>
              <p className="mt-1 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">当前状态说明</h2>
        <p className="mt-2 text-sm text-slate-700">{stageExplanation}</p>
        <p className="mt-2 text-xs text-slate-500">当前建议：{nextSuggestion}</p>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">现在最该注意</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {result.risks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">试做路径参考</h2>
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          可生产性评分：{result.production_score} / 100
          <br />
          搭建复杂度：{mapBuildDifficulty(result.buildDifficulty)}
          <br />
          当前建议：{nextSuggestion}
          <p className="mt-2 text-xs text-blue-800">
            该评分仅用于前期判断，不等同于真实打样或量产结论。
          </p>
        </div>
        {result.scoreDeductions && result.scoreDeductions.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">关键扣分原因（规则评分）</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {result.scoreDeductions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {result.manufacturabilityTips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">当前建议</h2>
        <p className="mt-2 text-xs text-slate-500">
          以下建议基于当前文字输入与零件草案，用于前期收敛方向，不等同于真实打样结论。
        </p>
        <div className="mt-3 space-y-3">
          {actionSuggestions.map((suggestion, index) => (
            <div key={suggestion.title} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {index === 0 ? "先做" : "再看"}：{suggestion.title}
                </p>
                <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                  {suggestion.priority}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">动作：{suggestion.action}</p>
              <p className="mt-1 text-xs text-slate-600">
                这样通常有助于：{suggestion.impact}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">继续补充这个方向</h2>
        <div className="mt-3">
          {realProjectId ? (
            <ManualEditSection projectId={realProjectId} initialContent={result.manualEditDraft} />
          ) : (
            <>
              <textarea
                rows={5}
                defaultValue={result.manualEditDraft}
                placeholder="可先写：本轮先保留的核心设定、准备先改的两点、下一轮希望验证的风险。"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              />
              <p className="mt-2 text-xs text-slate-500">演示项目不支持保存人工编辑内容。</p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">当前更适合怎么推进</h2>
        <p className="mt-2 text-sm text-slate-700">当前建议：{nextSuggestion}</p>
        <p className="mt-1 text-sm text-slate-600">为什么是这一步：{recommendationReasonText}</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {result.collaborationAdvice.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">推进路径选择</h2>
        <div className="mt-3">
          <ServiceRequestModals
            mainRecommendation={mainRecommendation}
            projectId={id}
            exportData={exportData}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/quick/path/small-batch"
            className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            去看试做路径
          </Link>
          <Link
            href="/showcase"
            className="inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            看相似灵感
          </Link>
        </div>
      </section>
    </section>
  );
}
