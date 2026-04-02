import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import ShowcaseVisual from "@/components/showcase-visual";
import { type ShowcaseCategory, type ShowcaseJudgement, type ShowcaseStage } from "@/data/showcase-projects";
import {
  getIntentStatusExplanation,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { buildQuickPathHref } from "@/lib/quick-path-context";
import {
  getQuickProjectPreviewImageUrl,
  listProjectsForCurrentVisitor,
  quickProjectHasImage
} from "@/services/project-service";
import { mapProjectCategoryToShowcaseCategory } from "@/lib/showcase-category";
import type { ProjectRow } from "@/types/project";

export const dynamic = "force-dynamic";

type FilterKey = "all" | ShowcaseStage;

type ProjectCardItem = {
  id: string;
  name: string;
  projectType: "轻量创意" | "完整方案";
  visualCategory: ShowcaseCategory;
  stage: ShowcaseStage;
  statusExplanation: string;
  judgement: ShowcaseJudgement;
  recentStatus: string;
  nextSuggestion: string;
  updatedAtLabel: string;
  sortAt: string;
  viewHref: string;
  viewLabel: string;
  publicDisplayHref?: string | null;
  liveShowcaseHref?: string | null;
  latestQuoteStatus?: string | null;
  latestQuoteVersion?: number | null;
  currentIntentStatus?: string | null;
  imageUrl?: string | null;
  coverAccentClass: string;
  priorityScore: number;
  isRecommendedToAdvance: boolean;
};

const stageFilters: ShowcaseStage[] = ["创意已生成", "方向判断完成", "已提交意向", "公开展示中"];

function clampTitle(value: string, maxChars = 24) {
  const compact = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(compact);
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars).join("")}…`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN");
}

function isQuickProject(category: string | null | undefined) {
  return category === "quick_entry";
}

function mapProjectRowToCard(item: ProjectRow): ProjectCardItem {
  const quick = isQuickProject(item.category);
  const hasImage = quickProjectHasImage(item.notes_for_factory);
  const previewImageUrl = getQuickProjectPreviewImageUrl(item.notes_for_factory);
  const linkedIntent = item.linked_intent;
  const linkedStage = mapProjectWithIntentToUnifiedStage({
    projectStatus: item.status,
    intentStatus: linkedIntent?.status,
    intentSourceType: linkedIntent?.source_type
  });

  if (linkedIntent) {
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: quick ? "轻量创意" : "完整方案",
      visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
      stage: linkedStage,
      statusExplanation: getIntentStatusExplanation({
        status: linkedIntent.status,
        sourceType: linkedIntent.source_type
      }),
      judgement: mapIntentSourceTypeToJudgement(linkedIntent.source_type),
      recentStatus:
        linkedIntent.source_type === "crowdfunding"
          ? "这条方向已经进入公开展示，当前更适合继续收集关注和反馈。"
          : `已经沿${mapIntentSourceTypeToPathLabel(linkedIntent.source_type)}继续推进，当前更适合看最新阶段和建议。`,
      nextSuggestion: inferIntentNextSuggestion({
        sourceType: linkedIntent.source_type,
        status: linkedIntent.status
      }),
      updatedAtLabel: formatDate(linkedIntent.updated_at || item.updated_at),
      sortAt: linkedIntent.updated_at || item.updated_at,
      viewHref: `/projects/${item.id}`,
      viewLabel: "查看这个项目",
      publicDisplayHref: linkedIntent.source_type === "crowdfunding" ? null : buildQuickPathHref("creator_plan", {
        projectId: item.id,
        idea: item.title || "未命名项目",
        direction: "",
        style: "",
        scale: "",
        referenceImage: "",
        quickJudgement: mapIntentSourceTypeToJudgement(linkedIntent.source_type),
        quickPath: ""
      }),
      liveShowcaseHref: linkedIntent.source_type === "crowdfunding" ? "/showcase?focus=live&sort=latest" : null,
      latestQuoteStatus: linkedIntent.latest_quote_status || null,
      latestQuoteVersion: linkedIntent.latest_quote_version ?? null,
      currentIntentStatus: linkedIntent.status,
      imageUrl: previewImageUrl,
      coverAccentClass:
        linkedIntent.source_type === "crowdfunding"
          ? "text-violet-800"
          : linkedIntent.source_type === "small_batch"
            ? "text-emerald-800"
            : "text-blue-800",
      priorityScore: linkedIntent.source_type === "crowdfunding" ? 88 : 94,
      isRecommendedToAdvance: linkedIntent.status !== "closed_lost"
    };
  }

  if (quick) {
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: "轻量创意",
      visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
      stage: linkedStage,
      statusExplanation: hasImage
        ? "方向判断已经完成，当前更适合先看试做路径，判断这个方向值不值得继续推进。"
        : "当前还处在创意已生成阶段，更适合继续补充方向和主体表达。",
      judgement: hasImage ? "更适合先做小批量验证" : "更适合先验证用户兴趣",
      recentStatus: hasImage ? "已有方向图和判断，当前更适合先看试做路径。" : "文字判断已经生成，建议继续补上方向图和判断。",
      nextSuggestion: hasImage ? "去看试做路径" : "继续补充方向",
      updatedAtLabel: formatDate(item.updated_at),
      sortAt: item.updated_at,
      viewHref: `/quick/result?quickProjectId=${item.id}`,
      viewLabel: "查看这个项目",
      publicDisplayHref: null,
      liveShowcaseHref: null,
      latestQuoteStatus: null,
      latestQuoteVersion: null,
      currentIntentStatus: null,
      imageUrl: previewImageUrl,
      coverAccentClass: hasImage ? "text-amber-800" : "text-slate-700",
      priorityScore: hasImage ? 84 : 68,
      isRecommendedToAdvance: hasImage
    };
  }

  if (item.status === "draft") {
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: "完整方案",
      visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
      stage: "创意已生成",
      statusExplanation: "当前还停留在创意已生成阶段，更适合先把方向和约束补完整。",
      judgement: "更适合扩展故事感",
      recentStatus: "完整方案还在草稿阶段，建议继续补充方向信息。",
      nextSuggestion: "生成完整方案",
      updatedAtLabel: formatDate(item.updated_at),
      sortAt: item.updated_at,
      viewHref: `/projects/${item.id}`,
      viewLabel: "查看这个项目",
      publicDisplayHref: buildQuickPathHref("creator_plan", {
        projectId: item.id,
        idea: item.title || "未命名项目",
        direction: "",
        style: "",
        scale: "",
        referenceImage: "",
        quickJudgement: "更适合扩展故事感",
        quickPath: ""
      }),
      liveShowcaseHref: null,
      latestQuoteStatus: null,
      latestQuoteVersion: null,
      currentIntentStatus: null,
      imageUrl: null,
      coverAccentClass: "text-rose-800",
      priorityScore: 70,
      isRecommendedToAdvance: false
    };
  }

  if (item.status === "generating") {
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: "完整方案",
      visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
      stage: "方向判断完成",
      statusExplanation: "方向判断已经完成，当前更适合继续完善结构与推进路径。",
      judgement: "更适合先验证用户兴趣",
      recentStatus: "完整方案正在整理中，稍后可以回来继续看。",
      nextSuggestion: "查看相似灵感",
      updatedAtLabel: formatDate(item.updated_at),
      sortAt: item.updated_at,
      viewHref: `/projects/${item.id}`,
      viewLabel: "查看这个项目",
      publicDisplayHref: buildQuickPathHref("creator_plan", {
        projectId: item.id,
        idea: item.title || "未命名项目",
        direction: "",
        style: "",
        scale: "",
        referenceImage: "",
        quickJudgement: "更适合先验证用户兴趣",
        quickPath: ""
      }),
      liveShowcaseHref: null,
      latestQuoteStatus: null,
      latestQuoteVersion: null,
      currentIntentStatus: null,
      imageUrl: null,
      coverAccentClass: "text-blue-800",
      priorityScore: 76,
      isRecommendedToAdvance: true
    };
  }

  return {
    id: item.id,
    name: clampTitle(item.title || "未命名项目"),
    projectType: "完整方案",
    visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
    stage: "已提交意向",
    statusExplanation: "当前已提交意向，说明这个方向已经进入进一步沟通和推进阶段。",
    judgement: "更适合先做小批量验证",
    recentStatus: "完整方案已经生成，当前更适合继续走试做或意向路径。",
    nextSuggestion: "去看试做路径",
    updatedAtLabel: formatDate(item.updated_at),
    sortAt: item.updated_at,
    viewHref: `/projects/${item.id}`,
    viewLabel: "查看这个项目",
    publicDisplayHref: buildQuickPathHref("creator_plan", {
      projectId: item.id,
      idea: item.title || "未命名项目",
      direction: "",
      style: "",
      scale: "",
      referenceImage: "",
      quickJudgement: "更适合先做小批量验证",
      quickPath: ""
    }),
    liveShowcaseHref: null,
    latestQuoteStatus: null,
    latestQuoteVersion: null,
    currentIntentStatus: null,
    imageUrl: null,
    coverAccentClass: "text-emerald-800",
    priorityScore: 92,
    isRecommendedToAdvance: true
  };
}

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearch = (await searchParams) || {};
  const filterRaw = Array.isArray(resolvedSearch.filter) ? resolvedSearch.filter[0] : resolvedSearch.filter;
  const filter: FilterKey = stageFilters.includes((filterRaw || "") as ShowcaseStage)
    ? (filterRaw as ShowcaseStage)
    : "all";

  let dbProjects: ProjectRow[] = [];
  try {
    dbProjects = await listProjectsForCurrentVisitor();
  } catch {
    dbProjects = [];
  }

  const projects = dbProjects.map(mapProjectRowToCard);
  const filteredProjects = projects
    .filter((project) => (filter === "all" ? true : project.stage === filter))
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  const topProject = [...projects].sort((a, b) => b.priorityScore - a.priorityScore)[0] || null;

  return (
    <section className="space-y-6">
      <div className="page-hero bg-[radial-gradient(circle_at_top_left,_rgba(253,230,138,0.36),_transparent_30%),radial-gradient(circle_at_84%_20%,_rgba(191,219,254,0.15),_transparent_26%),linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,0.9))]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <p className="eyebrow">
              AI积木设计师
            </p>
            <h1 className="display-title text-4xl font-black text-slate-900 sm:text-5xl">我的</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">这里只看两件事：现在先做哪一条，还有下一步点哪里。</p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <LogoutButton />
            <Link
              href="/projects/new"
              className="primary-cta w-full flex-1 px-5 py-2.5 sm:w-auto sm:flex-none"
            >
              先试一个新方向
            </Link>
          </div>
        </div>
      </div>

      <section className="page-section border-amber-100 bg-[linear-gradient(180deg,rgba(255,248,220,0.88),rgba(255,255,255,0.84))]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-800">现在最适合先做这个</p>
            <p className="mt-2 text-sm text-slate-600">先做这一条，不用先管其它的。</p>
          </div>
        </div>
        {topProject ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-center">
            <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/74 shadow-[0_24px_48px_-36px_rgba(148,94,22,0.3)]">
              <ShowcaseVisual
                title={topProject.name}
                category={topProject.visualCategory}
                imageUrl={topProject.imageUrl}
                className="h-44 w-full"
              />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">{topProject.name}</h2>
              <p className="mt-3 text-base font-bold leading-7 text-slate-800">{topProject.nextSuggestion}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href={topProject.viewHref}
                  className="primary-cta px-4 py-2.5"
                >
                  继续做这条方向
                </Link>
                <span className="text-sm text-slate-500">现在到哪一步：{topProject.stage}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">先试一个新方向，才能在这里看到推进建议。</p>
        )}
      </section>

      <section className="page-section p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">其它方向</span>
          <Link
            href="/projects"
            className={`filter-chip ${
              filter === "all"
                ? "filter-chip-active"
                : ""
            }`}
          >
            全部
          </Link>
          {stageFilters.map((stage) => (
            <Link
              key={stage}
              href={`/projects?${new URLSearchParams({ filter: stage }).toString()}`}
              className={`filter-chip ${
                filter === stage
                  ? "filter-chip-active"
                  : ""
              }`}
            >
              {stage}
            </Link>
          ))}
        </div>
      </section>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProjects.map((project) => (
          <article
            key={project.id}
            className="visual-card flex h-full flex-col"
          >
              <div className="cover-frame h-40 p-5">
                <ShowcaseVisual
                  title={project.name}
                  category={project.visualCategory}
                  imageUrl={project.imageUrl}
                  className="absolute inset-0"
                />
                <div className="relative z-10 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{project.projectType}</span>
                  <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">{project.stage}</span>
                  {project.stage === "公开展示中" && (
                    <span className="rounded-full bg-violet-700/90 px-3 py-1 text-xs font-bold text-white">
                      广场可见
                    </span>
                  )}
                </div>
                <p className={`relative z-10 mt-8 max-w-[18rem] text-base font-black leading-7 ${project.coverAccentClass}`}>{project.judgement}</p>
              </div>
              <div className="flex flex-1 flex-col space-y-4 p-6">
                <h2 className="text-2xl font-black tracking-tight text-slate-900" title={project.name}>
                  {project.name}
                </h2>
                <p className="text-sm font-bold tracking-[0.08em] text-amber-700">{project.nextSuggestion}</p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="mt-2 text-xs font-bold text-slate-400">现在到哪一步</p>
                    <p className="mt-1 text-xs text-slate-500">{project.stage}</p>
                  </div>
                  <Link href={project.viewHref} className="text-sm font-bold text-amber-700 hover:text-amber-900">
                    继续做这条方向
                  </Link>
                </div>
                <p className="text-xs text-slate-400">更新：{project.updatedAtLabel}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            {filter === "all" ? "你还没有正在推进的项目" : `你还没有进入「${filter}」的项目`}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            可以先从一个轻创意方向开始，先看值不值得推进。
          </p>
          <Link
            href="/quick/new"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
          >
            去试一个新方向
          </Link>
        </section>
      )}
    </section>
  );
}
