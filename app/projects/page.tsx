import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import ShowcaseVisual from "@/components/showcase-visual";
import { type ShowcaseCategory, type ShowcaseStage } from "@/data/showcase-projects";
import {
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import {
  getQuickProjectImageMeta,
  getQuickProjectPreviewImageUrl,
  listIntentsForCurrentVisitor,
  listProjectsForCurrentVisitor,
  quickProjectHasImage
} from "@/services/project-service";
import { mapProjectCategoryToShowcaseCategory } from "@/lib/showcase-category";
import type { ProjectRow } from "@/types/project";

export const dynamic = "force-dynamic";

type MyTab = "ideas" | "published" | "buying";

type ProjectCardItem = {
  id: string;
  name: string;
  projectType: "轻量创意" | "完整方案";
  visualCategory: ShowcaseCategory;
  stage: ShowcaseStage;
  nextSuggestion: string;
  updatedAtLabel: string;
  sortAt: string;
  viewHref: string;
  currentIntentStatus?: string | null;
  intentSourceType?: string | null;
  imageUrl?: string | null;
  coverAccentClass: string;
  priorityScore: number;
};

type BuyingIntentCard = {
  id: string;
  title: string;
  nextSuggestion: string;
  updatedAt: string;
  priceHint: string;
  href: string;
};

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

function formatPriceRange(min: number | null | undefined, max: number | null | undefined) {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return "";
  if (Number.isFinite(min) && Number.isFinite(max)) return `¥${min} - ¥${max}`;
  if (Number.isFinite(min)) return `≥ ¥${min}`;
  return `≤ ¥${max}`;
}

function isQuickProject(category: string | null | undefined) {
  return category === "quick_entry";
}

function mapProjectRowToCard(item: ProjectRow): ProjectCardItem {
  const quick = isQuickProject(item.category);
  const imageMeta = getQuickProjectImageMeta(item.notes_for_factory);
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
      nextSuggestion: inferIntentNextSuggestion({
        sourceType: linkedIntent.source_type,
        status: linkedIntent.status
      }),
      updatedAtLabel: formatDate(linkedIntent.updated_at || item.updated_at),
      sortAt: linkedIntent.updated_at || item.updated_at,
      viewHref: `/projects/${item.id}`,
      currentIntentStatus: linkedIntent.status,
      intentSourceType: linkedIntent.source_type,
      imageUrl: previewImageUrl,
      coverAccentClass:
        linkedIntent.source_type === "crowdfunding"
          ? "text-violet-800"
          : linkedIntent.source_type === "small_batch"
            ? "text-emerald-800"
            : "text-blue-800",
      priorityScore: linkedIntent.source_type === "crowdfunding" ? 92 : 84
    };
  }

  if (quick) {
    const isImageGenerating = imageMeta.imageStatus === "queued" || imageMeta.imageStatus === "generating";
    const isImageFailed = imageMeta.imageStatus === "failed";
    return {
      id: item.id,
      name: clampTitle(item.title || "未命名项目"),
      projectType: "轻量创意",
      visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
      stage: linkedStage,
      nextSuggestion: hasImage ? "发出来看看" : isImageGenerating ? "稍后回来看看" : isImageFailed ? "重新生成预览图" : "继续补一张方向图",
      updatedAtLabel: formatDate(item.updated_at),
      sortAt: item.updated_at,
      viewHref: `/quick/result?quickProjectId=${item.id}`,
      currentIntentStatus: null,
      intentSourceType: null,
      imageUrl: previewImageUrl,
      coverAccentClass: hasImage ? "text-amber-800" : "text-slate-700",
      priorityScore: hasImage ? 80 : 68
    };
  }

  return {
    id: item.id,
    name: clampTitle(item.title || "未命名项目"),
    projectType: "完整方案",
    visualCategory: mapProjectCategoryToShowcaseCategory(item.category),
    stage: item.status === "draft" ? "创意已生成" : item.status === "generating" ? "方向判断完成" : "已提交意向",
    nextSuggestion: item.status === "draft" ? "继续完善这个方向" : item.status === "generating" ? "稍后回来看看" : "继续推进这条方向",
    updatedAtLabel: formatDate(item.updated_at),
    sortAt: item.updated_at,
    viewHref: `/projects/${item.id}`,
    currentIntentStatus: null,
    intentSourceType: null,
    imageUrl: null,
    coverAccentClass: item.status === "draft" ? "text-rose-800" : "text-blue-800",
    priorityScore: item.status === "draft" ? 70 : 76
  };
}

export default async function ProjectsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearch = (await searchParams) || {};
  const tabRaw = Array.isArray(resolvedSearch.tab) ? resolvedSearch.tab[0] : resolvedSearch.tab;
  const tab: MyTab = tabRaw === "published" || tabRaw === "buying" ? tabRaw : "ideas";

  let dbProjects: ProjectRow[] = [];
  let buyingIntents: Array<{
    id: string;
    updated_at: string;
    latest_snapshot?: {
      project_title?: string | null;
      estimated_total_price_min?: number | null;
      estimated_total_price_max?: number | null;
      ui_context?: Record<string, unknown> | null;
    } | null;
  }> = [];

  try {
    dbProjects = await listProjectsForCurrentVisitor();
  } catch {
    dbProjects = [];
  }

  try {
    const intentResult = await listIntentsForCurrentVisitor({ limit: 100 });
    buyingIntents = (intentResult.items || []) as typeof buyingIntents;
  } catch {
    buyingIntents = [];
  }

  const cards = dbProjects.map(mapProjectRowToCard);
  const ideaProjects = cards
    .filter((item) => item.intentSourceType !== "crowdfunding")
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  const publishedProjects = cards
    .filter((item) => item.intentSourceType === "crowdfunding")
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  const buyingCards: BuyingIntentCard[] = buyingIntents
    .filter((item) => {
      const intentKind = (item.latest_snapshot?.ui_context as { intentKind?: string } | null)?.intentKind;
      return intentKind === "purchase_interest";
    })
    .map((item) => {
      const priceRange = formatPriceRange(
        item.latest_snapshot?.estimated_total_price_min,
        item.latest_snapshot?.estimated_total_price_max
      );
      return {
        id: item.id,
        title: item.latest_snapshot?.project_title || "未命名量产方向",
        nextSuggestion: "查看这条量产记录",
        updatedAt: item.updated_at,
        priceHint: priceRange ? `参考价格：${priceRange}` : "后面有量产消息时，会优先记在这里。",
        href: `/intents/${item.id}`
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const currentProjectCards = tab === "published" ? publishedProjects : ideaProjects;
  const topBuyingCard = buyingCards[0] || null;
  const topProjectCard = [...currentProjectCards].sort((a, b) => b.priorityScore - a.priorityScore)[0] || null;

  const tabMeta = {
    ideas: {
      title: "我的创意",
      emptyTitle: "你还没有正在推进的创意",
      emptyCopy: "先试一个方向，觉得不错再发出来看看。"
    },
    published: {
      title: "我的发布",
      emptyTitle: "你还没有发出来的方向",
      emptyCopy: "先试一个方向，觉得不错就先发出来。"
    },
    buying: {
      title: "我的想买",
      emptyTitle: "你还没有记下想买的量产版",
      emptyCopy: "去看看别人发的内容，给喜欢的方向投票并记下想买。"
    }
  } satisfies Record<MyTab, { title: string; emptyTitle: string; emptyCopy: string }>;

  return (
    <section className="space-y-6">
      <div className="page-hero bg-[radial-gradient(circle_at_top_left,_rgba(253,230,138,0.36),_transparent_30%),radial-gradient(circle_at_84%_20%,_rgba(191,219,254,0.15),_transparent_26%),linear-gradient(180deg,rgba(255,251,235,0.78),rgba(255,255,255,0.9))]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="space-y-3">
            <p className="eyebrow">AI积木设计师</p>
            <h1 className="display-title text-4xl font-black text-slate-900 sm:text-5xl">我的</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">这里只看三件事：我在试什么、我发了什么、我想买什么。</p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <LogoutButton />
            <Link href="/quick/new" className="primary-cta w-full flex-1 px-5 py-2.5 sm:w-auto sm:flex-none">
              先试一个新方向
            </Link>
          </div>
        </div>
      </div>

      <section className="page-section p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">切换看看</span>
          <Link href="/projects" className={`filter-chip ${tab === "ideas" ? "filter-chip-active" : ""}`}>
            我的创意
          </Link>
          <Link href="/projects?tab=published" className={`filter-chip ${tab === "published" ? "filter-chip-active" : ""}`}>
            我的发布
          </Link>
          <Link href="/projects?tab=buying" className={`filter-chip ${tab === "buying" ? "filter-chip-active" : ""}`}>
            我的想买
          </Link>
        </div>
      </section>

      <section className="page-section border-amber-100 bg-[linear-gradient(180deg,rgba(255,248,220,0.88),rgba(255,255,255,0.84))]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-amber-800">现在最适合先做这个</p>
            <p className="mt-2 text-sm text-slate-600">{tabMeta[tab].title}里，先做这一条就行。</p>
          </div>
        </div>
        {(tab === "buying" ? topBuyingCard : topProjectCard) ? (
          tab === "buying" ? (
            <div className="mt-5 rounded-[28px] border border-white/80 bg-white/75 p-6 shadow-[0_24px_48px_-36px_rgba(148,94,22,0.3)]">
              <h2 className="text-3xl font-black tracking-tight text-slate-900">{topBuyingCard?.title}</h2>
              <p className="mt-3 text-base font-bold leading-7 text-slate-800">{topBuyingCard?.nextSuggestion}</p>
              <p className="mt-2 text-sm text-slate-500">{topBuyingCard?.priceHint}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link href={topBuyingCard?.href || "/projects?tab=buying"} className="primary-cta px-4 py-2.5">
                  去看这条记录
                </Link>
                <span className="text-sm text-slate-500">更新：{formatDate(topBuyingCard?.updatedAt || "")}</span>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-[0.74fr_1.26fr] lg:items-center">
              <div className="overflow-hidden rounded-[30px] border border-white/80 bg-white/74 shadow-[0_24px_48px_-36px_rgba(148,94,22,0.3)]">
                <ShowcaseVisual
                  title={topProjectCard?.name || "未命名项目"}
                  category={topProjectCard?.visualCategory || "城市文创"}
                  imageUrl={topProjectCard?.imageUrl}
                  className="h-44 w-full"
                />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900">{topProjectCard?.name}</h2>
                <p className="mt-3 text-base font-bold leading-7 text-slate-800">{topProjectCard?.nextSuggestion}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link href={topProjectCard?.viewHref || "/projects"} className="primary-cta px-4 py-2.5">
                    继续看这条
                  </Link>
                  <span className="text-sm text-slate-500">现在到哪一步：{topProjectCard?.stage}</span>
                </div>
              </div>
            </div>
          )
        ) : (
          <p className="mt-2 text-sm text-slate-600">{tabMeta[tab].emptyCopy}</p>
        )}
      </section>

      {tab === "buying" ? (
        buyingCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {buyingCards.map((item) => (
              <article key={item.id} className="visual-card flex h-full flex-col">
                <div className="cover-frame h-40 p-5">
                  <div className="relative z-10 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">我的想买</span>
                    <span className="rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-bold text-white">量产关注中</span>
                  </div>
                  <p className="relative z-10 mt-8 max-w-[18rem] text-base font-black leading-7 text-emerald-900">我想买量产版</p>
                </div>
                <div className="flex flex-1 flex-col space-y-4 p-6">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{item.title}</h2>
                  <p className="text-sm font-bold tracking-[0.08em] text-emerald-700">{item.nextSuggestion}</p>
                  <p className="text-sm text-slate-600">{item.priceHint}</p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
                    <p className="text-xs text-slate-400">更新：{formatDate(item.updatedAt)}</p>
                    <Link href={item.href} className="text-sm font-bold text-emerald-700 hover:text-emerald-900">
                      去看这条记录
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <h2 className="text-lg font-bold text-slate-900">{tabMeta.buying.emptyTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">{tabMeta.buying.emptyCopy}</p>
            <Link
              href="/showcase"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
            >
              去看大家发的内容
            </Link>
          </section>
        )
      ) : currentProjectCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {currentProjectCards.map((project) => (
            <article key={project.id} className="visual-card flex h-full flex-col">
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
                  {project.intentSourceType === "crowdfunding" ? (
                    <span className="rounded-full bg-violet-700/90 px-3 py-1 text-xs font-bold text-white">已发出来</span>
                  ) : null}
                </div>
                <p className={`relative z-10 mt-8 max-w-[18rem] text-base font-black leading-7 ${project.coverAccentClass}`}>
                  {project.intentSourceType === "crowdfunding"
                    ? mapIntentSourceTypeToJudgement(project.intentSourceType)
                    : project.nextSuggestion}
                </p>
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
                    继续看这条
                  </Link>
                </div>
                <p className="text-xs text-slate-400">更新：{project.updatedAtLabel}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">{tabMeta[tab].emptyTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{tabMeta[tab].emptyCopy}</p>
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
