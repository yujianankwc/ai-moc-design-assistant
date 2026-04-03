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
  listPublicShowcaseProjects,
  type PublicShowcaseSortKey
} from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

const categories: Array<ShowcaseCategory | "全部"> = SHOWCASE_CATEGORY_FILTERS;
const SHOWCASE_PAGE_SIZE = 12;

const sortOptions: Array<{ key: PublicShowcaseSortKey; label: string }> = [
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
};

function mapRealProjectToShowcaseCard(item: ProjectRow): ShowcaseCardItem | null {
  if (item.linked_intent?.source_type !== "crowdfunding") return null;
  const category = mapProjectCategoryToShowcaseCategory(item.category);
  const judgement = mapIntentSourceTypeToJudgement(item.linked_intent.source_type);
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
    sourceLabel: "真实项目"
  };
}

function buildShowcaseHref(input: {
  category?: ShowcaseCategory | "全部";
  sort?: PublicShowcaseSortKey;
  focus?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (input.category && input.category !== "全部") params.set("category", input.category);
  if (input.sort && input.sort !== "popular") params.set("sort", input.sort);
  if (input.focus === "live") params.set("focus", "live");
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return `/showcase${query ? `?${query}` : ""}`;
}

function getMasonryVisualHeightClass(index: number) {
  const cycle = [
    "h-72 sm:h-80",
    "h-[22rem] sm:h-[26rem]",
    "h-80 sm:h-[23rem]",
    "h-[19rem] sm:h-[21rem]",
    "h-[24rem] sm:h-[28rem]",
    "h-72 sm:h-[22rem]"
  ];
  return cycle[index % cycle.length];
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5];
  }
  if (currentPage >= totalPages - 2) {
    return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
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
  const pageRaw = Array.isArray(resolvedSearch.page) ? resolvedSearch.page[0] : resolvedSearch.page;
  const selectedCategory = categories.includes((categoryRaw || "") as ShowcaseCategory | "全部")
    ? ((categoryRaw as ShowcaseCategory | "全部") || "全部")
    : "全部";
  const sort = sortOptions.some((item) => item.key === sortRaw) ? (sortRaw as PublicShowcaseSortKey) : "popular";
  const isLiveFocus = focusRaw === "live";
  const requestedPage = Number.isFinite(Number(pageRaw)) ? Math.max(1, Number(pageRaw)) : 1;

  let realProjects: ProjectRow[] = [];
  let realTotal = 0;
  let realTotalPages = 0;
  let realPage = requestedPage;
  try {
    const realResult = await listPublicShowcaseProjects({
      page: requestedPage,
      pageSize: SHOWCASE_PAGE_SIZE,
      category: selectedCategory === "全部" ? null : selectedCategory,
      sort
    });
    realProjects = realResult.items;
    realTotal = realResult.total;
    realTotalPages = realResult.totalPages;
    realPage = realResult.page;
  } catch {
    realProjects = [];
    realTotal = 0;
    realTotalPages = 0;
    realPage = requestedPage;
  }

  const staticItems = getShowcaseProjectsBySort(sort as ShowcaseSortKey)
    .filter((item) => (selectedCategory === "全部" ? true : item.category === selectedCategory));
  const staticTotal = staticItems.length;
  const staticTotalPages = staticTotal === 0 ? 0 : Math.ceil(staticTotal / SHOWCASE_PAGE_SIZE);
  const staticPage = staticTotalPages === 0 ? 1 : Math.min(requestedPage, staticTotalPages);
  const staticPageItems: ShowcaseCardItem[] = staticItems
    .slice((staticPage - 1) * SHOWCASE_PAGE_SIZE, staticPage * SHOWCASE_PAGE_SIZE)
    .map((item) => ({
    id: item.slug,
    title: item.title,
    category: item.category,
    stage: item.stage,
    judgement: item.judgement,
    coverGradient: item.coverGradient,
    imageUrl: null,
    href: `/showcase/${item.slug}`,
    actionLabel: "去投票",
    sourceLabel: undefined
  }));

  const dynamicItems = realProjects.map(mapRealProjectToShowcaseCard).filter(Boolean) as ShowcaseCardItem[];
  const useDynamicItems = isLiveFocus || realTotal > 0;
  const items = useDynamicItems ? dynamicItems : staticPageItems;
  const totalPages = useDynamicItems ? realTotalPages : staticTotalPages;
  const currentPage = useDynamicItems ? realPage : staticPage;
  const visiblePages = totalPages > 1 ? getVisiblePages(currentPage, totalPages) : [];

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
                href={buildShowcaseHref({
                  category,
                  sort,
                  focus: isLiveFocus ? "live" : "",
                  page: 1
                })}
                className={`filter-chip ${selectedCategory === category ? "filter-chip-active" : ""}`}
              >
                {category}
              </Link>
            ))}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            <Link
              href={buildShowcaseHref({
                category: selectedCategory,
                sort: "latest",
                focus: "live",
                page: 1
              })}
              className={`filter-chip ${isLiveFocus ? "filter-chip-active" : ""}`}
            >
              最近公开展示
            </Link>
            {sortOptions.map((option) => (
              <Link
                key={option.key}
                href={buildShowcaseHref({
                  category: selectedCategory,
                  sort: option.key,
                  focus: isLiveFocus ? "live" : "",
                  page: 1
                })}
                className={`filter-chip ${sort === option.key ? "filter-chip-dark" : ""}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {items.length === 0 ? (
        <section className="page-section border-dashed border-slate-300 text-center">
          <h2 className="section-title">当前这组筛选下还没有公开内容</h2>
          <p className="section-copy mt-2">可以换个分类看看，或者先去试一个自己的创意。</p>
        </section>
      ) : (
        <div className="columns-1 [column-gap:1.25rem] md:columns-2 xl:columns-3 2xl:columns-4">
          {items.map((item, index) => (
            <article key={item.id} className="visual-card mb-5 inline-block w-full [break-inside:avoid] align-top">
              <div className={`cover-frame p-4 ${getMasonryVisualHeightClass(index)}`}>
                <ShowcaseVisual
                  title={item.title}
                  category={item.category}
                  imageUrl={item.imageUrl}
                  className="absolute inset-0"
                />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{item.category}</span>
                  {item.sourceLabel ? (
                    <span className="rounded-full bg-slate-950/78 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                      {item.sourceLabel}
                    </span>
                  ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-slate-950/82 via-slate-950/38 to-transparent px-4 pb-4 pt-16 sm:px-5 sm:pb-5">
                  <h2 className="max-w-[88%] line-clamp-2 text-[1.7rem] font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-[1.95rem]">
                    {item.title}
                  </h2>
                  <p className="mt-2 max-w-[86%] line-clamp-1 text-sm font-semibold text-white/90">{item.judgement}</p>
                </div>
              </div>
              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  <span>{item.stage}</span>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <section className="page-section p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={buildShowcaseHref({
                category: selectedCategory,
                sort,
                focus: isLiveFocus ? "live" : "",
                page: Math.max(1, currentPage - 1)
              })}
              aria-disabled={currentPage <= 1}
              className={`filter-chip ${currentPage <= 1 ? "pointer-events-none opacity-40" : ""}`}
            >
              上一页
            </Link>
            {visiblePages.map((page) => (
              <Link
                key={page}
                href={buildShowcaseHref({
                  category: selectedCategory,
                  sort,
                  focus: isLiveFocus ? "live" : "",
                  page
                })}
                className={`filter-chip ${page === currentPage ? "filter-chip-dark" : ""}`}
              >
                {page}
              </Link>
            ))}
            <Link
              href={buildShowcaseHref({
                category: selectedCategory,
                sort,
                focus: isLiveFocus ? "live" : "",
                page: Math.min(totalPages, currentPage + 1)
              })}
              aria-disabled={currentPage >= totalPages}
              className={`filter-chip ${currentPage >= totalPages ? "pointer-events-none opacity-40" : ""}`}
            >
              下一页
            </Link>
          </div>
        </section>
      ) : null}

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
