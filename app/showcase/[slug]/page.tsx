import Link from "next/link";
import ShowcaseInteractionBar from "@/components/showcase-interaction-bar";
import ShowcaseVisual from "@/components/showcase-visual";
import {
  getFeaturedShowcaseProjects,
  getRelatedShowcaseProjects,
  getShowcaseProjectBySlug,
  type ShowcaseCategory,
  type ShowcaseProject,
  type ShowcaseStage
} from "@/data/showcase-projects";
import {
  formatIntentFollowupSummary,
  getIntentStatusExplanation,
  inferFitForFromJudgement,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { mapAudience } from "@/lib/display-mappers";
import { mapProjectCategoryToShowcaseCategory } from "@/lib/showcase-category";
import {
  getQuickProjectPreviewImageUrl,
  getProjectWithOutputById,
  getQuickProjectModerationMeta,
  getShowcaseInteractionSummary,
  SYSTEM_FALLBACK_MARKER
} from "@/services/project-service";

export const dynamic = "force-dynamic";

const stageSteps = ["创意已生成", "方向判断完成", "已提交意向", "公开展示中"] as const;

type RealShowcaseDetail = {
  type: "real";
  id: string;
  title: string;
  category: ShowcaseCategory;
  stage: ShowcaseStage;
  popularityHint: string;
  coverGradient: string;
  coverAccentClass: string;
  imageUrl?: string | null;
  hook: string;
  judgement: ShowcaseProject["judgement"];
  fitFor: string;
  audience: string;
  statusExplanation: string;
  nextSuggestion: string;
  caution: string;
  whyItWorks: string;
  updates: string[];
  likes: number;
  watchers: number;
  quickTryHref: string;
  related: ShowcaseProject[];
  publicSourceLabel: string;
};

type DetailModel =
  | { type: "static"; project: ShowcaseProject; quickTryHref: string; related: ShowcaseProject[] }
  | RealShowcaseDetail;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildQuickTryHref(title: string, tag: string) {
  return `/quick/new?idea=${encodeURIComponent(`${title}，更偏${tag}方向`)}`;
}

async function getDetailModel(slug: string): Promise<DetailModel | null> {
  const staticProject = getShowcaseProjectBySlug(slug);
  if (staticProject) {
    return {
      type: "static",
      project: staticProject,
      quickTryHref: buildQuickTryHref(staticProject.title, staticProject.tags[0] || staticProject.category),
      related: getRelatedShowcaseProjects(staticProject, 3)
    };
  }

  if (!isUuid(slug)) return null;

  const detail = await getProjectWithOutputById(slug).catch(() => null);
  if (!detail?.project?.linked_intent || detail.project.linked_intent.source_type !== "crowdfunding") {
    return null;
  }
  const moderationMeta = getQuickProjectModerationMeta(detail.project.notes_for_factory);
  if (moderationMeta.publishEligibility !== "public" || moderationMeta.imageModerationStatus !== "approved") {
    return null;
  }

  const { project, output } = detail;
  const linkedIntent = project.linked_intent;
  const category = mapProjectCategoryToShowcaseCategory(project.category);
  const judgement = mapIntentSourceTypeToJudgement(linkedIntent.source_type);
  const stage = mapProjectWithIntentToUnifiedStage({
    projectStatus: project.status,
    intentStatus: linkedIntent.status,
    intentSourceType: linkedIntent.source_type
  });
  const showcaseControl = linkedIntent.showcase_control;
  const popularityHint = showcaseControl?.homepage
    ? "首页优先展示中的真实项目"
    : showcaseControl?.featured
      ? "当前被选为精选公开展示"
      : "来自真实项目的公开展示";
  const updateItems =
    linkedIntent.recent_followups?.map((item) =>
      formatIntentFollowupSummary({
        actionType: item.action_type,
        content: item.content,
        fromStatus: item.from_status,
        toStatus: item.to_status
      })
    ) || [];
  const whyItWorks =
    output?.design_positioning ||
    output?.design_summary ||
    project.title ||
    "这个方向已经进入真实项目公开展示，说明它具备继续被外部用户看见和判断的价值。";
  const caution =
    output?.risk_notes?.split("\n").map((item) => item.trim()).find(Boolean) ||
    "当前还需要继续观察外部反馈，再决定是否往更深的推进阶段走。";
  const hook =
    output?.design_summary ||
    project.title ||
    "这条方向已经进入公开展示，适合先让更多人看到这个项目。";
  const fallbackTag = output?.internal_recommendation?.includes(SYSTEM_FALLBACK_MARKER);
  const related = getFeaturedShowcaseProjects(6)
    .filter((item) => item.category === category)
    .slice(0, 3);

  return {
    type: "real",
    id: slug,
    title: project.title || "未命名项目",
    category,
    stage,
    popularityHint,
    coverGradient: "from-violet-100 via-fuchsia-50 to-white",
    coverAccentClass: "text-violet-800",
    imageUrl: getQuickProjectPreviewImageUrl(project.notes_for_factory),
    hook,
    judgement,
    fitFor: inferFitForFromJudgement(judgement),
    audience: mapAudience(project.audience),
    statusExplanation: getIntentStatusExplanation({
      status: linkedIntent.status,
      sourceType: linkedIntent.source_type
    }),
    nextSuggestion: inferIntentNextSuggestion({
      sourceType: linkedIntent.source_type,
      status: linkedIntent.status
    }),
    caution,
    whyItWorks,
    updates:
      updateItems.length > 0
        ? updateItems
        : [
            fallbackTag
              ? "当前展示内容里含系统回退结果，建议后续补一次真实复核。"
              : "这条方向已经进入真实项目公开展示。",
            "当前更适合先收集关注和反馈，再判断是否继续推进。"
          ],
    likes: 0,
    watchers: 0,
    quickTryHref: buildQuickTryHref(project.title || "未命名项目", mapIntentSourceTypeToPathLabel(linkedIntent.source_type)),
    related,
    publicSourceLabel: "真实项目公开展示"
  };
}

function renderStage(stepStage: ShowcaseStage) {
  return (
    <div className="mt-5 rounded-3xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
      <div className="grid gap-3 sm:grid-cols-4">
        {stageSteps.map((step, index) => {
          const active = stageSteps.indexOf(stepStage) >= index;
          const current = stepStage === step;
          return (
            <div key={step} className="flex items-center gap-3 sm:flex-col sm:items-start">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  current
                    ? "bg-slate-900 text-white"
                    : active
                      ? "bg-amber-200 text-amber-900"
                      : "bg-white text-slate-400"
                }`}
              >
                {index + 1}
              </div>
              <p className={`text-xs font-bold ${current ? "text-slate-900" : active ? "text-slate-700" : "text-slate-400"}`}>
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function ShowcaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const resolvedSearch = (await searchParams) || {};
  const autoBuyRaw = Array.isArray(resolvedSearch.autobuy) ? resolvedSearch.autobuy[0] : resolvedSearch.autobuy;
  const detail = await getDetailModel(slug);
  const interactionSummary = await getShowcaseInteractionSummary(slug).catch(() => ({
    likes: 0,
    watchers: 0,
    liked: false,
    watching: false
  }));

  if (!detail) {
    return (
      <section className="rounded-3xl border-2 border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">这个案例还没准备好</h1>
        <p className="mt-2 text-sm text-slate-600">你可以先回去看看别的方向。</p>
        <Link href="/showcase" className="mt-4 inline-flex text-sm font-bold text-amber-700 hover:text-amber-900">
          回去再看看
        </Link>
      </section>
    );
  }

  const isStatic = detail.type === "static";
  const project = isStatic ? detail.project : detail;
  const quickTryHref = isStatic ? detail.quickTryHref : detail.quickTryHref;
  const related = isStatic ? detail.related : detail.related;
  const sourceLabel = isStatic ? project.popularityHint : detail.publicSourceLabel;
  const imageUrl = isStatic ? null : detail.imageUrl;
  const autoBuy = autoBuyRaw === "1" && !isStatic;
  const buyIntentPayload = isStatic
    ? null
    : {
        projectId: detail.id,
        projectTitle: detail.title,
        resultSummary: detail.judgement
      };

  return (
    <section className="space-y-6">
      <section className={`page-hero overflow-hidden bg-gradient-to-br ${project.coverGradient}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{project.category}</span>
            <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">{project.stage}</span>
          </div>
          <p className={`text-xs font-bold sm:text-sm ${project.coverAccentClass}`}>{sourceLabel}</p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">{project.title}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">{project.hook}</p>
            {!isStatic && (
              <p className="mt-3 inline-flex rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-bold text-violet-800">
                大家正在看这个方向
              </p>
            )}
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/50 shadow-sm">
            <ShowcaseVisual
              title={project.title}
              category={project.category}
              imageUrl={imageUrl}
              className="h-44 w-full sm:h-56"
            />
          </div>
        </div>

        <ShowcaseInteractionBar
          showcaseKey={slug}
          baseLikes={project.likes}
          baseWatchers={project.watchers}
          initialPersistedLikes={interactionSummary.likes}
          initialPersistedWatchers={interactionSummary.watchers}
          initialLiked={interactionSummary.liked}
          initialWatching={interactionSummary.watching}
          quickTryHref={quickTryHref}
          autoBuy={autoBuy}
          buyIntentPayload={buyIntentPayload}
        />

        {renderStage(project.stage)}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <article className="page-section">
            <h2 className="section-title">为什么大家会想看这个方向</h2>
            <p className="mt-3 text-sm font-bold text-slate-900">{project.judgement}</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{project.whyItWorks}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">更适合先怎么玩</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{project.fitFor}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-400">更适合谁</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{project.audience}</p>
              </div>
            </div>
          </article>
          <article className="page-section">
            <h2 className="section-title">接下来可以怎么玩</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{project.statusExplanation}</p>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700">现在最适合</p>
              <p className="mt-2 text-sm font-bold text-amber-950">{project.nextSuggestion}</p>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">现在最该注意：{project.caution}</p>
          </article>
        </div>

        <aside className="space-y-4">
          <section className="page-section border-amber-100 bg-amber-50">
            <h2 className="section-title">如果你也想参与这个方向</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              先给它投票，或者自己也试一个类似方向。觉得它真有机会量产，再补一条想买记录也不晚。
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href={quickTryHref}
                className="primary-cta"
              >
                我也想试一个
              </Link>
              <Link
                href="/showcase"
                className="secondary-cta"
              >
                回去再看看
              </Link>
            </div>
          </section>

          <section className="page-section border-blue-100 bg-blue-50/60">
            <h2 className="section-title">大家最近怎么反应</h2>
            <div className="mt-4 space-y-3">
              {project.updates.map((update) => (
                <div key={update} className="rounded-2xl bg-white/85 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                  {update}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {related.length > 0 ? (
        <section className="page-section">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">你也可以继续看看这些方向</h2>
              <p className="section-copy mt-2">先看看别人是怎么做的，再决定你想试哪个切入点。</p>
            </div>
            <Link href="/showcase" className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline">
              回去再看看
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <article key={item.slug} className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50/60">
                <div className={`h-24 bg-gradient-to-br ${item.coverGradient}`} />
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600">{item.category}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">{item.stage}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs font-bold text-slate-800">{item.judgement}</p>
                  <p className="text-xs leading-6 text-slate-500">{item.highlight}</p>
                  <Link href={`/showcase/${item.slug}`} className="inline-flex text-sm font-bold text-amber-700 hover:text-amber-900">
                    去给这条投票
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
