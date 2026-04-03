import Link from "next/link";
import ShowcaseVisual from "@/components/showcase-visual";
import {
  getFeaturedShowcaseProjects,
  type ShowcaseCategory,
  type ShowcaseJudgement
} from "@/data/showcase-projects";
import {
  mapIntentSourceTypeToJudgement,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { mapProjectCategoryToShowcaseCategory } from "@/lib/showcase-category";
import {
  getQuickProjectPreviewImageUrl,
  isQuickProjectPubliclyVisible,
  listProjectsForCurrentVisitor
} from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

type LandingCardItem = {
  id: string;
  title: string;
  category: ShowcaseCategory;
  stage: string;
  judgement: ShowcaseJudgement;
  recentStatus: string;
  tags: string[];
  coverGradient: string;
  coverAccentClass: string;
  imageUrl?: string | null;
  popularityHint: string;
  href: string;
  actionLabel: string;
  sourceLabel?: string;
  spotlightLabel?: string;
  featuredAtOrder: number;
};

function mapRealProjectToLandingCard(project: ProjectRow): LandingCardItem | null {
  if (project.linked_intent?.source_type !== "crowdfunding") return null;
  const showcaseControl = project.linked_intent.showcase_control;
  if (showcaseControl?.paused) return null;
  if (!isQuickProjectPubliclyVisible(project.notes_for_factory)) return null;

  const judgement = mapIntentSourceTypeToJudgement(project.linked_intent.source_type);
  const spotlightLabel = showcaseControl?.homepage
    ? "首页优先展示"
    : showcaseControl?.featured
      ? "精选公开展示"
      : "最近进入公开展示";
  const popularityHint = showcaseControl?.homepage
    ? "优先出现在首页公开展示位"
    : showcaseControl?.featured
      ? "来自精选公开展示"
      : "来自真实项目的公开展示";
  const featuredAtOrder =
    new Date(project.linked_intent.updated_at).getTime() +
    (showcaseControl?.homepage ? 60 : 0) +
    (showcaseControl?.featured ? 40 : 0);

  return {
    id: project.id,
    title: project.title || "未命名项目",
    category: mapProjectCategoryToShowcaseCategory(project.category),
    stage: mapProjectWithIntentToUnifiedStage({
      projectStatus: project.status,
      intentStatus: project.linked_intent.status,
      intentSourceType: project.linked_intent.source_type
    }),
    judgement,
    recentStatus: "",
    tags: [],
    coverGradient: "from-violet-100 via-fuchsia-50 to-white",
    coverAccentClass: "text-violet-900",
    imageUrl: getQuickProjectPreviewImageUrl(project.notes_for_factory),
    popularityHint,
    href: `/showcase/${project.id}`,
    actionLabel: "看看这个方向",
    sourceLabel: "真实项目",
    spotlightLabel,
    featuredAtOrder
  };
}

export default async function LandingPage() {
  let realProjects: ProjectRow[] = [];
  try {
    realProjects = await listProjectsForCurrentVisitor();
  } catch {
    realProjects = [];
  }

  const dynamicFeatured = realProjects
    .map(mapRealProjectToLandingCard)
    .filter(Boolean) as LandingCardItem[];

  const staticFeatured = getFeaturedShowcaseProjects(6).map((project) => ({
    id: project.slug,
    title: project.title,
    category: project.category,
    stage: project.stage,
    judgement: project.judgement,
    recentStatus: project.recentStatus,
    tags: project.tags,
    coverGradient: project.coverGradient,
    coverAccentClass: project.coverAccentClass,
    imageUrl: null,
    popularityHint: project.popularityHint,
    href: `/showcase/${project.slug}`,
    actionLabel: "看看这个方向",
    sourceLabel: undefined,
    spotlightLabel: undefined,
    featuredAtOrder: 0
  }));

  const featuredProjects =
    dynamicFeatured.length > 0
      ? [...dynamicFeatured].sort((a, b) => b.featuredAtOrder - a.featuredAtOrder).slice(0, 2)
      : staticFeatured.slice(0, 2);
  const heroVisual = featuredProjects[0] || staticFeatured[0];

  return (
    <section className="space-y-12">
      <section className="page-hero rounded-[40px] px-6 py-7 sm:px-10 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div className="max-w-3xl">
            <h1 className="display-title max-w-[7.4em] text-[2.65rem] font-semibold tracking-[-0.075em] text-slate-950 sm:max-w-[5.4em] sm:text-[4.8rem]">
              先试一个创意，
              <br />
              看看值不值得继续做。
            </h1>
            <p className="mt-5 max-w-md text-base leading-8 text-slate-500">
              先试一个创意，觉得不错就直接发出来，再看大家会不会支持它量产。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/quick/new" className="primary-cta px-7 py-3">
                先试一个创意
              </Link>
            </div>
            <Link href="/showcase" className="mt-5 inline-flex text-sm font-semibold text-slate-500 hover:text-slate-900">
              看看别人都发了什么
            </Link>
          </div>
          <div className="space-y-5 lg:pl-4">
            <div className="visual-card overflow-hidden rounded-[40px] border-slate-200/80 bg-white">
              <div className="brick-surface relative overflow-hidden bg-[#f7f5f0]">
                <ShowcaseVisual
                  title={heroVisual.title}
                  category={heroVisual.category}
                  imageUrl={heroVisual.imageUrl}
                  className="h-72 w-full sm:h-[29rem]"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-1">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-[-0.04em] text-slate-950 sm:text-xl">{heroVisual.title}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{heroVisual.category}</p>
              </div>
              <Link href={heroVisual.href} className="inline-flex shrink-0 text-sm font-semibold text-slate-900 hover:text-slate-600">
                看看这个方向
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section rounded-[40px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display-title text-4xl font-semibold tracking-[-0.06em] text-slate-950">先看看别人都发了什么。</h2>
            <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-500">先看内容，再决定你想支持哪个方向，或者自己也发一个。</p>
          </div>
          <Link href="/showcase" className="text-sm font-semibold text-slate-900 hover:text-slate-600">
            去看内容
          </Link>
        </div>
        <div className="mt-10 grid gap-6 xl:grid-cols-12">
          {featuredProjects.map((project, index) => (
            <article
              key={project.id}
              className={`visual-card rounded-[32px] border border-slate-200/80 bg-white ${
                index === 0 ? "xl:col-span-7" : "xl:col-span-5"
              }`}
            >
              <div className={`brick-surface cover-frame bg-[#f7f5f0] ${index === 0 ? "xl:min-h-[21rem]" : ""}`}>
                <ShowcaseVisual
                  title={project.title}
                  category={project.category}
                  imageUrl={project.imageUrl}
                  className={`${index === 0 ? "h-72 xl:h-[25rem]" : "h-64"} w-full`}
                />
                <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                  <span className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[color:var(--brand-accent)] shadow-sm">
                    {project.category}
                  </span>
                  <span className="rounded-full border border-white/25 bg-slate-950/70 px-3 py-1 text-white backdrop-blur">
                    {project.stage}
                  </span>
                </div>
              </div>
              <div className={`space-y-4 px-6 py-6 ${index === 0 ? "xl:px-8 xl:py-7" : ""}`}>
                <h3
                  className={`display-title font-semibold tracking-[-0.05em] text-slate-950 ${
                    index === 0 ? "text-[2.4rem]" : "text-[2rem]"
                  }`}
                >
                  {project.title}
                </h3>
                <p className="line-clamp-2 text-sm leading-7 text-slate-500">{project.judgement}</p>
                <div className="flex items-center justify-between gap-4 pt-1">
                  <Link href={project.href} className="inline-flex text-sm font-semibold text-slate-900 hover:text-slate-600">
                    {project.actionLabel}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="page-section rounded-[32px] px-6 py-6 sm:px-8">
        <p className="text-center text-sm font-semibold text-slate-500 sm:text-base">
          先让更多人发出来、投票，再慢慢挑出更适合量产的方向。
        </p>
      </section>
    </section>
  );
}
