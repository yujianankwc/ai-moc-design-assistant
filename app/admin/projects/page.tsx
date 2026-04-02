import Link from "next/link";
import { buildQuickPathHref } from "@/lib/quick-path-context";
import { formatShowcaseDisplayControl } from "@/lib/showcase-display-control";
import {
  getIntentStatusExplanation,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import { listProjectsByDemoUser, quickProjectHasImage } from "@/services/project-service";
import type { ProjectRow } from "@/types/project";
import AdminShowcaseControl from "@/components/admin-showcase-control";

type ProjectStageFilter = "all" | "创意已生成" | "方向判断完成" | "已提交意向" | "公开展示中";
type ProjectSortKey = "recent" | "priority";
type ProjectSignalFilter = "all" | "quoted" | "deposit_pending" | "公开展示中";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function isQuickProject(category: string | null | undefined) {
  return category === "quick_entry";
}

function inferFallbackJudgement(item: ProjectRow) {
  if (item.category === "museum") return "更适合面向收藏用户";
  if (item.category === "scene") return "更适合桌面陈列 / 小场景方向";
  if (item.category === "campus" || item.category === "architecture") return "更适合礼物方向";
  return "更适合先做小批量验证";
}

function mapProjectCard(item: ProjectRow) {
  const linkedIntent = item.linked_intent;
  const quick = isQuickProject(item.category);
  const hasImage = quickProjectHasImage(item.notes_for_factory);
  const stage = mapProjectWithIntentToUnifiedStage({
    projectStatus: item.status,
    intentStatus: linkedIntent?.status,
    intentSourceType: linkedIntent?.source_type
  });

  if (linkedIntent) {
    return {
      id: item.id,
      title: item.title || "未命名项目",
      projectType: quick ? "轻量创意" : "完整方案",
      stage,
      pathLabel: mapIntentSourceTypeToPathLabel(linkedIntent.source_type),
      judgement: mapIntentSourceTypeToJudgement(linkedIntent.source_type),
      statusExplanation: getIntentStatusExplanation({
        status: linkedIntent.status,
        sourceType: linkedIntent.source_type
      }),
      nextSuggestion: inferIntentNextSuggestion({
        sourceType: linkedIntent.source_type,
        status: linkedIntent.status
      }),
      updatedAt: formatDate(linkedIntent.updated_at || item.updated_at),
      linkedIntentId: linkedIntent.id,
      latestQuoteStatus: linkedIntent.latest_quote_status || null,
      latestQuoteVersion: linkedIntent.latest_quote_version ?? null,
      currentIntentStatus: linkedIntent.status,
      showcaseControl: linkedIntent.showcase_control ?? null,
      publicDisplayHref:
        linkedIntent.source_type === "crowdfunding"
          ? null
          : buildQuickPathHref("creator_plan", {
              projectId: item.id,
              idea: item.title || "未命名项目",
              direction: "",
              style: "",
              scale: "",
              referenceImage: "",
              quickJudgement: mapIntentSourceTypeToJudgement(linkedIntent.source_type),
              quickPath: ""
            }),
      liveShowcaseHref: linkedIntent.source_type === "crowdfunding" ? "/showcase?focus=live&sort=latest" : null
    };
  }

  return {
    id: item.id,
    title: item.title || "未命名项目",
    projectType: quick ? "轻量创意" : "完整方案",
    stage,
    pathLabel: quick ? "试做路径" : "完整方案路径",
    judgement: quick ? (hasImage ? "更适合先做小批量验证" : "更适合先验证用户兴趣") : inferFallbackJudgement(item),
    statusExplanation: quick
      ? hasImage
        ? "当前已经有一版方向判断，更适合决定是否继续走试做路径。"
        : "当前还在创意已生成阶段，更适合先补足方向判断。"
      : "当前还没有关联推进意向，更适合先补清方向，再决定沿哪条路径继续。",
    nextSuggestion: quick ? (hasImage ? "去看试做路径" : "继续补充方向") : "先把这个方向补充完整",
    updatedAt: formatDate(item.updated_at),
    linkedIntentId: null,
    latestQuoteStatus: null,
    latestQuoteVersion: null,
    currentIntentStatus: null,
    showcaseControl: null,
    publicDisplayHref: buildQuickPathHref("creator_plan", {
      projectId: item.id,
      idea: item.title || "未命名项目",
      direction: "",
      style: "",
      scale: "",
      referenceImage: "",
      quickJudgement: quick ? (hasImage ? "更适合先做小批量验证" : "更适合先验证用户兴趣") : inferFallbackJudgement(item),
      quickPath: ""
    }),
    liveShowcaseHref: null
  };
}

function formatProjectCommercialSignal(input: {
  latestQuoteStatus?: string | null;
  currentIntentStatus?: string | null;
  stage: string;
}) {
  if (input.currentIntentStatus === "preparing_delivery") return "已经开始准备交付安排";
  if (input.currentIntentStatus === "delivering") return "正在继续跟进交付进度";
  if (input.currentIntentStatus === "delivered" || input.currentIntentStatus === "closed_won") return "这条方向已经完成交付";
  if (input.stage === "公开展示中") return "当前以公开展示和收集关注为主";
  if (input.latestQuoteStatus === "accepted") return "这版报价说明已经确认";
  if (input.latestQuoteStatus === "sent") return "已经给出一版报价说明";
  if (input.latestQuoteStatus === "draft") return "正在整理最新报价说明";
  if (input.stage === "已提交意向") return "已经进入更明确的推进阶段";
  return "当前还在前期判断阶段";
}

function matchesSignalFilter(
  item: ReturnType<typeof mapProjectCard>,
  signalFilter: ProjectSignalFilter
) {
  if (signalFilter === "all") return true;
  if (signalFilter === "公开展示中") return item.stage === "公开展示中";
  if (signalFilter === "deposit_pending") return item.linkedIntentId !== null && item.latestQuoteStatus === "accepted";
  if (signalFilter === "quoted") {
    return item.linkedIntentId !== null && (item.latestQuoteStatus === "sent" || item.latestQuoteStatus === "draft");
  }
  return true;
}

export default async function AdminProjectsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearch = (await searchParams) || {};
  const stageRaw = Array.isArray(resolvedSearch.stage) ? resolvedSearch.stage[0] : resolvedSearch.stage;
  const sortRaw = Array.isArray(resolvedSearch.sort) ? resolvedSearch.sort[0] : resolvedSearch.sort;
  const signalRaw = Array.isArray(resolvedSearch.signal) ? resolvedSearch.signal[0] : resolvedSearch.signal;
  const stageFilter: ProjectStageFilter =
    stageRaw === "创意已生成" || stageRaw === "方向判断完成" || stageRaw === "已提交意向" || stageRaw === "公开展示中"
      ? stageRaw
      : "all";
  const sort: ProjectSortKey = sortRaw === "priority" ? "priority" : "recent";
  const signalFilter: ProjectSignalFilter =
    signalRaw === "quoted" || signalRaw === "deposit_pending" || signalRaw === "公开展示中" ? signalRaw : "all";

  let projects: ProjectRow[] = [];
  try {
    projects = await listProjectsByDemoUser();
  } catch {
    projects = [];
  }

  const cards = projects.map(mapProjectCard);
  const filteredCards = cards
    .filter((item) => (stageFilter === "all" ? true : item.stage === stageFilter))
    .filter((item) => matchesSignalFilter(item, signalFilter))
    .sort((a, b) =>
      sort === "priority"
        ? Number(b.nextSuggestion !== "继续补充方向") - Number(a.nextSuggestion !== "继续补充方向")
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  const summary = {
    total: cards.length,
    publicDisplay: cards.filter((item) => item.stage === "公开展示中").length,
    withIntent: cards.filter((item) => item.linkedIntentId).length,
    worthAdvance: cards.filter((item) => item.nextSuggestion !== "继续补充方向").length,
    quoted: cards.filter((item) => item.latestQuoteStatus === "sent" || item.latestQuoteStatus === "draft").length,
    depositPending: cards.filter((item) => item.latestQuoteStatus === "accepted").length
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">项目总览中台</h1>
            <p className="mt-1 text-sm text-slate-600">
              这里先聚合测试期当前账号下的项目、关联推进意向和公开展示状态，方便内部快速判断哪些项目更值得继续推进。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/intents" className="font-medium text-blue-700 hover:underline">
              查看推进意向中台
            </Link>
            <Link href="/admin/showcase" className="font-medium text-violet-700 hover:underline">
              查看公开展示运营中台
            </Link>
            <Link href="/projects" className="font-medium text-slate-700 hover:underline">
              回到我的项目
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">项目总数</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-medium text-violet-700">公开展示中</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">{summary.publicDisplay}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">已关联推进意向</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{summary.withIntent}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">值得继续推进</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.worthAdvance}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">已给出报价说明</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{summary.quoted}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-medium text-orange-700">待继续补定金</p>
          <p className="mt-2 text-2xl font-bold text-orange-900">{summary.depositPending}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-medium text-violet-700">最近最适合先处理</p>
          <p className="mt-2 text-sm font-semibold text-violet-900">
            先看已报价和待继续补定金的项目，再回头看公开展示中的方向。
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "创意已生成", "方向判断完成", "已提交意向", "公开展示中"] as ProjectStageFilter[]).map((stage) => {
              const params = new URLSearchParams();
              if (stage !== "all") params.set("stage", stage);
              if (sort === "priority") params.set("sort", "priority");
              if (signalFilter !== "all") params.set("signal", signalFilter);
              return (
                <Link
                  key={stage}
                  href={`/admin/projects${params.toString() ? `?${params.toString()}` : ""}`}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                    stageFilter === stage
                      ? "border-2 border-amber-300 bg-amber-50 text-amber-900"
                      : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  {stage === "all" ? "全部阶段" : stage}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "全部推进信号" },
              { key: "quoted", label: "已报价说明" },
              { key: "deposit_pending", label: "待继续补定金" },
              { key: "公开展示中", label: "公开展示中" }
            ].map((item) => {
              const params = new URLSearchParams();
              if (stageFilter !== "all") params.set("stage", stageFilter);
              if (sort === "priority") params.set("sort", "priority");
              if (item.key !== "all") params.set("signal", item.key);
              return (
                <Link
                  key={item.key}
                  href={`/admin/projects${params.toString() ? `?${params.toString()}` : ""}`}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                    signalFilter === item.key
                      ? "border-2 border-blue-300 bg-blue-50 text-blue-900"
                      : "border-2 border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "recent", label: "最近更新" },
              { key: "priority", label: "值得优先推进" }
            ].map((item) => {
              const params = new URLSearchParams();
              if (stageFilter !== "all") params.set("stage", stageFilter);
              if (signalFilter !== "all") params.set("signal", signalFilter);
              if (item.key === "priority") params.set("sort", "priority");
              return (
                <Link
                  key={item.key}
                  href={`/admin/projects${params.toString() ? `?${params.toString()}` : ""}`}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold ${
                    sort === item.key
                      ? "border-2 border-slate-900 bg-slate-900 text-white"
                      : "border-2 border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {filteredCards.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            {stageFilter === "all" && signalFilter === "all"
              ? "当前还没有可查看的项目"
              : `当前还没有符合这组筛选条件的项目`}
          </h2>
          <p className="mt-2 text-sm text-slate-600">可以先去前台试一个方向，项目和推进意向会逐步在这里汇总起来。</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/quick/new" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              先试一个创意
            </Link>
            <Link href="/admin/intents" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              去看推进意向中台
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredCards.map((item) => (
            <article key={item.id} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-bold text-white">{item.stage}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{item.pathLabel}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{item.projectType}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm font-bold text-slate-900">{item.judgement}</p>
              <p className="mt-2 text-sm text-slate-600">{item.statusExplanation}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">当前建议</p>
                <p className="mt-1 text-sm font-semibold text-amber-800">{item.nextSuggestion}</p>
                <p className="mt-2 text-xs font-medium text-slate-500">推进信号</p>
                <p className="mt-1 text-xs text-slate-700">
                  {formatProjectCommercialSignal({
                    latestQuoteStatus: item.latestQuoteStatus,
                    currentIntentStatus: item.currentIntentStatus,
                    stage: item.stage
                  })}
                  {item.latestQuoteVersion ? ` · 最新报价 v${item.latestQuoteVersion}` : ""}
                </p>
                <p className="mt-2 text-xs text-slate-500">最近更新：{item.updatedAt}</p>
                {item.showcaseControl && item.pathLabel === "公开展示路径" ? (
                  <>
                    <p className="mt-2 text-xs font-medium text-slate-500">公开展示控制</p>
                    <p className="mt-1 text-xs text-slate-700">{formatShowcaseDisplayControl(item.showcaseControl)}</p>
                  </>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/projects/${item.id}`} className="font-medium text-blue-700 hover:underline">
                  查看这个项目
                </Link>
                {item.linkedIntentId && (
                  <Link
                    href={`/admin/intents?${new URLSearchParams({
                      intentId: item.linkedIntentId,
                      ...(item.pathLabel === "试做路径"
                        ? { sourceType: "small_batch" }
                        : item.pathLabel === "完整方案路径"
                          ? { sourceType: "pro_upgrade" }
                          : { sourceType: "crowdfunding" })
                    }).toString()}`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    去推进意向中台继续看
                  </Link>
                )}
                {item.publicDisplayHref && (
                  <Link href={item.publicDisplayHref} className="font-medium text-violet-700 hover:underline">
                    让它进入公开展示
                  </Link>
                )}
                {item.liveShowcaseHref && (
                  <Link href={item.liveShowcaseHref} className="font-medium text-violet-700 hover:underline">
                    看最近公开展示项目
                  </Link>
                )}
              </div>
              {item.linkedIntentId && item.pathLabel === "公开展示路径" && item.showcaseControl ? (
                <AdminShowcaseControl intentId={item.linkedIntentId} control={item.showcaseControl} />
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
