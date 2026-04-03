import Link from "next/link";
import ShowcaseVisual from "@/components/showcase-visual";
import {
  getShowcaseProjectsBySort,
  type ShowcaseJudgement,
  type ShowcaseCategory,
  type ShowcaseSortKey
} from "@/data/showcase-projects";
import {
  mapIntentSourceTypeToJudgement,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { mapProjectCategoryToShowcaseCategory, SHOWCASE_CATEGORY_FILTERS } from "@/lib/showcase-category";
import {
  getQuickProjectPreviewImageUrl,
  isQuickProjectPubliclyVisible,
  listProjectsForCurrentVisitor
} from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

const categories: Array<ShowcaseCategory | "全部"> = SHOWCASE_CATEGORY_FILTERS;

const sortOptions: Array<{ key: ShowcaseSortKey; label: string }> = [
  { key: "popular", label: "最受欢迎" },
  { key: "latest", label: "最新发布" }
];

type ShowcaseCardItem = {
  id: string;
  title: string;
  category: ShowcaseCategory;
  stage: string;
  judgement: ShowcaseJudgement;
  coverGradient: string;
  imageUrl?: string | null;
  href: string;
  actionLabel: string;
  sourceLabel?: string;
  featuredAtOrder: number;
  sortWeight: { latest: number; popular: number; trial: number };
};

function mapRealProjectToShowcaseCard(item: ProjectRow): ShowcaseCardItem | null {
  if (item.linked_intent?.source_type !== "crowdfunding") return null;
  const showcaseControl = item.linked_intent.showcase_control;
  if (showcaseControl?.paused) return null;
  if (!isQuickProjectPubliclyVisible(item.notes_for_factory)) return null;
  const category = mapProjectCategoryToShowcaseCategory(item.category);
  const judgement = mapIntentSourceTypeToJudgement(item.linked_intent.source_type);
  const latestOrder = new Date(item.linked_intent.updated_at).getTime();
  const featuredBoost = showcaseControl?.featured ? 40 : 0;
  const homepageBoost = showcaseControl?.homepage ? 60 : 0;
  return {
    id: item.id,
    title: item.title || "未命名项目",
    category,
    stage: mapProjectWithIntentToUnifiedStage({
      projectStatus: item.status,
      intentStatus: item.linked_intent.status,
      intentSourceType: item.linked_intent.source_type
    }),
    judgement,
    coverGradient: "from-violet-100 via-fuchsia-50 to-white",
    imageUrl: getQuickProjectPreviewImageUrl(item.notes_for_factory),
    href: `/showcase/${item.id}`,
    actionLabel: "去投票",
    sourceLabel: "真实项目",
    featuredAtOrder: latestOrder + homepageBoost + featuredBoost,
    sortWeight: {
      latest: 99 + homepageBoost + featuredBoost,
      popular: 92 + homepageBoost + featuredBoost,
      trial: 90 + featuredBoost + Math.floor(homepageBoost / 2)
    }
  };
}

export default async function ShowcasePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearch = (await searchParams) || {};
  const categoryRaw = Array.isArray(resolvedSearch.category) ? resolvedSearch.category[0] : resolvedSearch.category;
  const sortRaw = Array.isArray(resolvedSearch.sort) ? resolvedSearch.sort[0] : resolvedSearch.sort;
  const focusRaw = Array.isArray(resolvedSearch.focus) ? resolvedSearch.focus[0] : resolvedSearch.focus;
  const selectedCategory = categories.includes((categoryRaw || "") as ShowcaseCategory | "全部")
    ? ((categoryRaw as ShowcaseCategory | "全部") || "全部")
    : "全部";
  const sort = sortOptions.some((item) => item.key === sortRaw) ? (sortRaw as ShowcaseSortKey) : "popular";
  const isLiveFocus = focusRaw === "live";

  let realProjects: ProjectRow[] = [];
  try {
    realProjects = await listProjectsForCurrentVisitor();
  } catch {
    realProjects = [];
  }

  const staticItems: ShowcaseCardItem[] = getShowcaseProjectsBySort(sort).map((item) => ({
    id: item.slug,
    title: item.title,
    category: item.category,
    stage: item.stage,
    judgement: item.judgement,
    coverGradient: item.coverGradient,
    imageUrl: null,
    href: `/showcase/${item.slug}`,
    actionLabel: "去投票",
    featuredAtOrder: 0,
    sortWeight: item.sortWeight
  }));

  const dynamicItems = realProjects.map(mapRealProjectToShowcaseCard).filter(Boolean) as ShowcaseCardItem[];
  const sortedDynamicItems = [...dynamicItems].sort((a, b) => b.featuredAtOrder - a.featuredAtOrder);
  const baseItems = isLiveFocus
    ? sortedDynamicItems
    : dynamicItems.length > 0
      ? sortedDynamicItems
      : staticItems;
  const items = baseItems
    .filter((item) => (selectedCategory === "全部" ? true : item.category === selectedCategory))
    .sort((a, b) => b.sortWeight[sort] - a.sortWeight[sort]);

  return (
    <section className="space-y-6">
      <div className="page-hero bg-[radial-gradient(circle_at_top_left,_rgba(253,230,138,0.4),_transparent_30%),radial-gradient(circle_at_82%_26%,_rgba(196,181,253,0.18),_transparent_26%),linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,0.9))]">
        <h1 className="display-title text-4xl font-black sm:text-5xl">大家已经发了这些方向</h1>
        <p className="mt-3 text-sm text-slate-600">先看内容，再决定你想支持哪个方向。</p>
      </div>

      <section className="page-section p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/showcase${category === "全部" ? "" : `?category=${encodeURIComponent(category)}&sort=${sort}`}`}
                className={`filter-chip ${selectedCategory === category ? "filter-chip-active" : ""}`}
              >
                {category}
              </Link>
            ))}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <Link
              href="/showcase?focus=live&sort=latest"
              className={`filter-chip ${isLiveFocus ? "filter-chip-active" : ""}`}
            >
              最近公开展示
            </Link>
            {sortOptions.map((option) => (
              <Link
                key={option.key}
                href={`/showcase?${new URLSearchParams({
                  ...(selectedCategory === "全部" ? {} : { category: selectedCategory }),
                  sort: option.key
                }).toString()}`}
                className={`filter-chip ${sort === option.key ? "filter-chip-dark" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={item.id}
            className={`visual-card flex h-full flex-col ${index === 0 ? "md:col-span-2 xl:col-span-2" : ""}`}
          >
            <div className={`cover-frame p-4 ${index === 0 ? "h-64 sm:h-80" : "h-52 sm:h-60"}`}>
              <ShowcaseVisual
                title={item.title}
                category={item.category}
                imageUrl={item.imageUrl}
                className="absolute inset-0"
              />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{item.category}</span>
                {index === 0 ? (
                  <span className="rounded-full bg-slate-950/78 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                    先看这个
                  </span>
                ) : null}
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/78 via-slate-950/34 to-transparent px-4 pb-4 pt-14 sm:px-5 sm:pb-5">
                <h2
                  className={`max-w-[86%] line-clamp-2 font-black tracking-[-0.05em] text-white ${
                    index === 0 ? "text-[1.95rem] leading-[0.92] sm:text-[2.35rem]" : "text-[1.45rem] leading-[0.95] sm:text-[1.65rem]"
                  }`}
                >
                  {item.title}
                </h2>
                <p className={`max-w-[78%] line-clamp-1 font-semibold text-white/90 ${index === 0 ? "mt-2 text-sm leading-6 sm:text-[0.95rem]" : "mt-2 text-xs leading-5 sm:text-sm"}`}>
                  {item.judgement}
                </p>
              </div>
            </div>
            <div className={`flex flex-1 flex-col p-6 ${index === 0 ? "pt-6 sm:px-7 sm:pb-7" : "pt-5"}`}>
              <div className="mt-auto border-t border-slate-100/80 pt-4">
                <Link
                  href={item.href}
                  className={`inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 font-bold text-white transition hover:bg-slate-800 ${
                    index === 0 ? "py-3.5 text-base" : "py-3 text-sm"
                  }`}
                >
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="page-section text-center">
        <h2 className="section-title">你也可以先发一个自己的方向</h2>
        <p className="section-copy mt-2">先试一下，觉得不错就发出来看看。</p>
        <Link
          href="/quick/new"
          className="primary-cta mt-4"
        >
          先试一个创意
        </Link>
      </section>
    </section>
  );
}
