import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import {
  getFeaturedShowcaseProjects,
  type ShowcaseJudgement,
  type ShowcaseNextSuggestion,
  type ShowcaseStage
} from "@/data/showcase-projects";
import { formatNextSuggestionLabel } from "@/lib/project-language";
import { listProjectsByDemoUser, quickProjectHasImage } from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

export const dynamic = "force-dynamic";

type FilterKey = "all" | ShowcaseStage;
type SortKey = "recent" | "priority";

type ProjectCardItem = {
  id: string;
  name: string;
  projectType: "轻量创意" | "完整方案";
  stage: ShowcaseStage;
  statusExplanation: string;
  judgement: ShowcaseJudgement;
  recentStatus: string;
  nextSuggestion: ShowcaseNextSuggestion;
  updatedAt: string;
  viewHref: string;
  viewLabel: string;
  coverGradient: string;
  coverAccentClass: string;
  priorityScore: number;
  isRecommendedToAdvance: boolean;
};

const stageFilters: ShowcaseStage[] = ["创意已生成", "方向判断完成", "已提交意向", "公开展示中"];

const demoProjects = getFeaturedShowcaseProjects(4).map((project, index) => ({
  id: `showcase-${project.slug}`,
  name: project.title,
  projectType: index % 2 === 0 ? "轻量创意" : "完整方案",
  stage: project.stage,
  statusExplanation: project.statusExplanation,
  judgement: project.judgement,
  recentStatus: project.recentStatus,
  nextSuggestion: project.nextSuggestion,
  updatedAt: `2026-03-0${index + 2}`,
  viewHref: index % 2 === 0 ? "/quick/result" : "/projects/new",
  viewLabel: "查看这个项目",
  coverGradient: project.coverGradient,
  coverAccentClass: project.coverAccentClass,
  priorityScore: project.priorityScore,
  isRecommendedToAdvance: project.isRecommendedToAdvance
}));

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

  if (quick) {
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: "轻量创意",
      stage: hasImage ? "方向判断完成" : "创意已生成",
      statusExplanation: hasImage
        ? "方向判断已经完成，当前更适合先看试做路径，判断这个方向值不值得继续推进。"
        : "当前还处在创意已生成阶段，更适合继续补充方向和主体表达。",
      judgement: hasImage ? "更适合先做小批量验证" : "更适合先验证用户兴趣",
      recentStatus: hasImage ? "已有方向图和判断，当前更适合先看试做路径。" : "文字判断已经生成，建议继续补上方向图和判断。",
      nextSuggestion: hasImage ? "去看试做路径" : "继续补充方向",
      updatedAt: formatDate(item.updated_at),
      viewHref: `/quick/result?quickProjectId=${item.id}`,
      viewLabel: "查看这个项目",
      coverGradient: hasImage ? "from-amber-100 via-orange-50 to-white" : "from-slate-200 via-slate-100 to-white",
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
      stage: "创意已生成",
      statusExplanation: "当前还停留在创意已生成阶段，更适合先把方向和约束补完整。",
      judgement: "更适合扩展故事感",
      recentStatus: "完整方案还在草稿阶段，建议继续补充方向信息。",
      nextSuggestion: "生成完整方案",
      updatedAt: formatDate(item.updated_at),
      viewHref: `/projects/${item.id}`,
      viewLabel: "查看这个项目",
      coverGradient: "from-rose-100 via-red-50 to-white",
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
      stage: "方向判断完成",
      statusExplanation: "方向判断已经完成，当前更适合继续完善结构与推进路径。",
      judgement: "更适合先验证用户兴趣",
      recentStatus: "完整方案正在整理中，稍后可以回来继续看。",
      nextSuggestion: "查看相似灵感",
      updatedAt: formatDate(item.updated_at),
      viewHref: `/projects/${item.id}`,
      viewLabel: "查看这个项目",
      coverGradient: "from-blue-100 via-sky-50 to-white",
      coverAccentClass: "text-blue-800",
      priorityScore: 76,
      isRecommendedToAdvance: true
    };
  }

  return {
    id: item.id,
    name: clampTitle(item.title || "未命名项目"),
    projectType: "完整方案",
    stage: "已提交意向",
    statusExplanation: "当前已提交意向，说明这个方向已经进入进一步沟通和推进阶段。",
    judgement: "更适合先做小批量验证",
    recentStatus: "完整方案已经生成，当前更适合继续走试做或意向路径。",
    nextSuggestion: "去看试做路径",
    updatedAt: formatDate(item.updated_at),
    viewHref: `/projects/${item.id}`,
    viewLabel: "查看这个项目",
    coverGradient: "from-emerald-100 via-lime-50 to-white",
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
  const sortRaw = Array.isArray(resolvedSearch.sort) ? resolvedSearch.sort[0] : resolvedSearch.sort;
  const filter: FilterKey = stageFilters.includes((filterRaw || "") as ShowcaseStage)
    ? (filterRaw as ShowcaseStage)
    : "all";
  const sort: SortKey = sortRaw === "priority" ? "priority" : "recent";

  let dbProjects: ProjectRow[] = [];
  try {
    dbProjects = await listProjectsByDemoUser();
  } catch {
    dbProjects = [];
  }

  const projects = dbProjects.length > 0 ? dbProjects.map(mapProjectRowToCard) : demoProjects;
  const filteredProjects = projects
    .filter((project) => (filter === "all" ? true : project.stage === filter))
    .sort((a, b) =>
      sort === "priority"
        ? b.priorityScore - a.priorityScore
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const totalProjects = projects.length;
  const publicCount = projects.filter((item) => item.stage === "公开展示中").length;
  const intentCount = projects.filter((item) => item.stage === "已提交意向").length;
  const recommendedCount = projects.filter((item) => item.isRecommendedToAdvance).length;
  const topProject = [...projects].sort((a, b) => b.priorityScore - a.priorityScore)[0] || null;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            AI积木设计师 · 我的项目
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">我的项目推进面板</h1>
          <p className="text-sm text-slate-600">这里记录你正在推进的项目、当前阶段，以及下一步更适合做什么。</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <LogoutButton />
          <Link
            href="/projects/new"
            className="relative inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
          >
            新建项目
          </Link>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">项目总数</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{totalProjects}</p>
          </div>
          <div className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">公开展示中</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{publicCount}</p>
          </div>
          <div className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">已提交意向</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{intentCount}</p>
          </div>
          <div className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold text-slate-400">值得优先推进</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{recommendedCount}</p>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-amber-100 bg-amber-50/70 p-5 shadow-sm">
          <p className="text-xs font-bold text-amber-800">当前最值得继续推进</p>
          {topProject ? (
            <>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{topProject.name}</h2>
              <p className="mt-2 text-sm text-slate-700">{topProject.judgement}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{topProject.recentStatus}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">先试一个新方向，才能在这里看到推进建议。</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects${sort === "priority" ? "?sort=priority" : ""}`}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                filter === "all"
                  ? "border-2 border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                  : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
              }`}
            >
              全部
            </Link>
            {stageFilters.map((stage) => (
              <Link
                key={stage}
                href={`/projects?${new URLSearchParams({ filter: stage, ...(sort === "priority" ? { sort } : {}) }).toString()}`}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  filter === stage
                    ? "border-2 border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                    : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                {stage}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "recent", label: "最近更新" },
              { key: "priority", label: "值得优先推进" }
            ].map((item) => (
              <Link
                key={item.key}
                href={`/projects${new URLSearchParams({
                  ...(filter === "all" ? {} : { filter }),
                  ...(item.key === "priority" ? { sort: "priority" } : {})
                }).toString() ? `?${new URLSearchParams({
                  ...(filter === "all" ? {} : { filter }),
                  ...(item.key === "priority" ? { sort: "priority" } : {})
                }).toString()}` : ""}`}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  sort === item.key
                    ? "border-2 border-slate-900 bg-slate-900 text-white"
                    : "border-2 border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProjects.map((project) => (
            <article
              key={project.id}
              className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_10px_0_0_#fde68a]"
            >
              <div className={`h-28 bg-gradient-to-br ${project.coverGradient} p-5`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{project.projectType}</span>
                  <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">{project.stage}</span>
                </div>
                <p className={`mt-4 text-sm font-black ${project.coverAccentClass}`}>{project.judgement}</p>
              </div>
              <div className="space-y-3 p-5">
                <h2 className="text-lg font-bold text-slate-900" title={project.name}>
                  {project.name}
                </h2>
                <p className="text-xs leading-6 text-slate-500">{project.statusExplanation}</p>
                <div className="rounded-2xl bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-slate-400">最近状态</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{project.recentStatus}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div>
                    <p className="text-xs font-bold text-slate-400">当前建议</p>
                    <p className="mt-1 text-sm font-bold text-amber-700">{formatNextSuggestionLabel(project.nextSuggestion)}</p>
                    <p className="mt-1 text-xs text-slate-400">最近更新：{project.updatedAt}</p>
                  </div>
                  <Link href={project.viewHref} className="text-sm font-bold text-amber-700 hover:text-amber-900">
                    {project.viewLabel}
                  </Link>
                </div>
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
