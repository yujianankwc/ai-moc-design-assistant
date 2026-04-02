import Link from "next/link";
import AdminShowcaseControl from "@/components/admin-showcase-control";
import { formatShowcaseDisplayControl } from "@/lib/showcase-display-control";
import {
  getIntentStatusExplanation,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapProjectWithIntentToUnifiedStage
} from "@/lib/project-language";
import {
  getShowcaseInteractionStatsByProjectIds,
  listProjectsByDemoUser
} from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

type ShowcaseOpsCard = {
  id: string;
  title: string;
  stage: string;
  judgement: string;
  statusExplanation: string;
  nextSuggestion: string;
  updatedAt: string;
  showcaseControl: {
    featured: boolean;
    homepage: boolean;
    paused: boolean;
  };
  likes: number;
  watchers: number;
  latestInteractionAt: string | null;
  linkedIntentId: string;
};

function mapProjectToShowcaseOpsCard(
  project: ProjectRow,
  interactionStats: Awaited<ReturnType<typeof getShowcaseInteractionStatsByProjectIds>>
): ShowcaseOpsCard | null {
  const linkedIntent = project.linked_intent;
  if (!linkedIntent || linkedIntent.source_type !== "crowdfunding") return null;
  const stats = interactionStats[project.id] || {
    likes: 0,
    watchers: 0,
    latestInteractionAt: null
  };

  return {
    id: project.id,
    title: project.title || "未命名项目",
    stage: mapProjectWithIntentToUnifiedStage({
      projectStatus: project.status,
      intentStatus: linkedIntent.status,
      intentSourceType: linkedIntent.source_type
    }),
    judgement: mapIntentSourceTypeToJudgement(linkedIntent.source_type),
    statusExplanation: getIntentStatusExplanation({
      status: linkedIntent.status,
      sourceType: linkedIntent.source_type
    }),
    nextSuggestion: inferIntentNextSuggestion({
      sourceType: linkedIntent.source_type,
      status: linkedIntent.status
    }),
    updatedAt: formatDate(linkedIntent.updated_at || project.updated_at),
    showcaseControl: linkedIntent.showcase_control ?? {
      featured: false,
      homepage: false,
      paused: false
    },
    likes: stats.likes,
    watchers: stats.watchers,
    latestInteractionAt: stats.latestInteractionAt,
    linkedIntentId: linkedIntent.id
  };
}

export default async function AdminShowcasePage() {
  let projects: ProjectRow[] = [];
  try {
    projects = await listProjectsByDemoUser();
  } catch {
    projects = [];
  }

  let interactionStats: Awaited<ReturnType<typeof getShowcaseInteractionStatsByProjectIds>> = {};
  try {
    interactionStats = await getShowcaseInteractionStatsByProjectIds(
      projects
        .filter((item) => item.linked_intent?.source_type === "crowdfunding")
        .map((item) => item.id)
    );
  } catch {
    interactionStats = {};
  }

  const cards = projects
    .map((item) => mapProjectToShowcaseOpsCard(item, interactionStats))
    .filter(Boolean) as ShowcaseOpsCard[];

  const sortedCards = [...cards].sort((a, b) => {
    const score = (item: ShowcaseOpsCard) =>
      Number(item.showcaseControl.homepage) * 3 +
      Number(item.showcaseControl.featured) * 2 -
      Number(item.showcaseControl.paused);
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const summary = {
    total: sortedCards.length,
    homepage: sortedCards.filter((item) => item.showcaseControl.homepage && !item.showcaseControl.paused).length,
    featured: sortedCards.filter((item) => item.showcaseControl.featured && !item.showcaseControl.paused).length,
    paused: sortedCards.filter((item) => item.showcaseControl.paused).length,
    likes: sortedCards.reduce((sum, item) => sum + item.likes, 0),
    watchers: sortedCards.reduce((sum, item) => sum + item.watchers, 0),
    activeFeedback: sortedCards.filter((item) => item.likes > 0 || item.watchers > 0).length
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">公开展示运营中台</h1>
            <p className="mt-1 text-sm text-slate-600">
              这里集中处理已经进入公开展示路径的真实项目，方便内部统一控制首页优先、精选展示和暂停展示。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/projects" className="font-medium text-blue-700 hover:underline">
              回到项目总览中台
            </Link>
            <Link href="/showcase?focus=live&sort=latest" className="font-medium text-violet-700 hover:underline">
              去看最近公开展示项目
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">公开展示项目总数</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-medium text-violet-700">首页优先展示</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">{summary.homepage}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">精选展示</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{summary.featured}</p>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-700">暂停公开展示</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.paused}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-medium text-rose-700">累计收藏反馈</p>
          <p className="mt-2 text-2xl font-bold text-rose-900">{summary.likes}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">累计想看后续</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{summary.watchers}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">已有真实反馈的项目</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.activeFeedback}</p>
        </div>
      </section>

      {sortedCards.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">当前还没有进入公开展示路径的真实项目</h2>
          <p className="mt-2 text-sm text-slate-600">
            可以先在项目总览中台里把合适的项目推进到公开展示路径，再回到这里统一做运营控制。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/admin/projects" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              去项目总览中台
            </Link>
            <Link href="/showcase" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              去看灵感广场
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sortedCards.map((item) => (
            <article key={item.id} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-700/90 px-3 py-1 text-xs font-bold text-white">{item.stage}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {formatShowcaseDisplayControl(item.showcaseControl)}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm font-bold text-slate-900">{item.judgement}</p>
              <p className="mt-2 text-sm text-slate-600">{item.statusExplanation}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">当前建议</p>
                <p className="mt-1 text-sm font-semibold text-violet-800">{item.nextSuggestion}</p>
                <p className="mt-2 text-xs text-slate-500">最近更新：{item.updatedAt}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">收藏反馈</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{item.likes}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">想看后续</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{item.watchers}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">最近互动</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {item.latestInteractionAt ? formatDate(item.latestInteractionAt) : "还没有互动"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <Link href={`/projects/${item.id}`} className="font-medium text-blue-700 hover:underline">
                  查看这个项目
                </Link>
                <Link href={`/admin/intents?intentId=${item.linkedIntentId}&sourceType=crowdfunding`} className="font-medium text-slate-700 hover:underline">
                  去推进意向中台继续看
                </Link>
                <Link href="/showcase?focus=live&sort=latest" className="font-medium text-violet-700 hover:underline">
                  看最近公开展示项目
                </Link>
              </div>
              <AdminShowcaseControl intentId={item.linkedIntentId} control={item.showcaseControl} />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
