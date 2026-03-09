import Link from "next/link";
import {
  getShowcaseProjectsBySort,
  type ShowcaseCategory,
  type ShowcaseSortKey
} from "@/data/showcase-projects";

const categories: Array<ShowcaseCategory | "全部"> = [
  "全部",
  "城市文创",
  "高校主题",
  "文博纪念",
  "家庭场景",
  "奇幻场景",
  "机械载具"
];

const sortOptions: Array<{ key: ShowcaseSortKey; label: string }> = [
  { key: "latest", label: "最新发布" },
  { key: "popular", label: "最受欢迎" },
  { key: "trial", label: "值得试做" }
];

export default async function ShowcasePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearch = (await searchParams) || {};
  const categoryRaw = Array.isArray(resolvedSearch.category) ? resolvedSearch.category[0] : resolvedSearch.category;
  const sortRaw = Array.isArray(resolvedSearch.sort) ? resolvedSearch.sort[0] : resolvedSearch.sort;
  const selectedCategory = categories.includes((categoryRaw || "") as ShowcaseCategory | "全部")
    ? ((categoryRaw as ShowcaseCategory | "全部") || "全部")
    : "全部";
  const sort = sortOptions.some((item) => item.key === sortRaw) ? (sortRaw as ShowcaseSortKey) : "popular";

  const items = getShowcaseProjectsBySort(sort).filter((item) =>
    selectedCategory === "全部" ? true : item.category === selectedCategory
  );

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border-2 border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-[0_12px_36px_-22px_rgba(217,119,6,0.35)] sm:p-8">
        <p className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
          灵感广场
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">别人已经在这样玩了</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          这里不是素材库，而是正在被推进的积木创意。你可以先看看哪些方向更值得试做、哪些题材更有人气。
        </p>
      </div>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/showcase${category === "全部" ? "" : `?category=${encodeURIComponent(category)}&sort=${sort}`}`}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${
                  selectedCategory === category
                    ? "border-2 border-amber-300 bg-amber-50 text-amber-900"
                    : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                {category}
              </Link>
            ))}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {sortOptions.map((option) => (
              <Link
                key={option.key}
                href={`/showcase?${new URLSearchParams({
                  ...(selectedCategory === "全部" ? {} : { category: selectedCategory }),
                  sort: option.key
                }).toString()}`}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold ${
                  sort === option.key
                    ? "border-2 border-slate-900 bg-slate-900 text-white"
                    : "border-2 border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.slug}
            className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_10px_0_0_#fde68a]"
          >
            <div className={`h-44 p-5 bg-gradient-to-br ${item.coverGradient}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{item.category}</span>
                <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">{item.stage}</span>
              </div>
              <p className="mt-6 max-w-[16rem] text-lg font-bold text-slate-900">{item.title}</p>
              <p className="mt-2 max-w-[18rem] text-sm text-slate-700">{item.hook}</p>
            </div>
            <div className="p-5">
              <p className={`text-xs font-bold ${item.coverAccentClass}`}>{item.popularityHint}</p>
              <p className="mt-2 text-base font-bold text-slate-900">{item.judgement}</p>
              <p className="mt-2 text-sm text-slate-600">{item.recentStatus}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">当前建议</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.nextSuggestion}</p>
                </div>
                <Link
                  href={`/showcase/${item.slug}`}
                  className="shrink-0 inline-flex items-center text-sm font-bold text-amber-700 hover:text-amber-900"
                >
                  看看这个方向
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">你也可以先试一个自己的方向</h2>
        <p className="mt-2 text-sm text-slate-600">先得到一版方向判断，再决定是否继续推进。</p>
        <Link
          href="/quick/new"
          className="mt-4 inline-flex rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all hover:bg-amber-300"
        >
          先试一个创意
        </Link>
      </section>
    </section>
  );
}
