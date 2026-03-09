"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getRelatedShowcaseProjects, getShowcaseProjectBySlug } from "@/data/showcase-projects";

const stageSteps = ["创意已生成", "方向判断完成", "已提交意向", "公开展示中"] as const;

export default function ShowcaseDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const project = slug ? getShowcaseProjectBySlug(slug) : null;
  const [liked, setLiked] = useState(false);
  const [watching, setWatching] = useState(false);

  const related = useMemo(
    () => (project ? getRelatedShowcaseProjects(project, 3) : []),
    [project]
  );

  if (!project) {
    return (
      <section className="rounded-3xl border-2 border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">这个案例还没准备好</h1>
        <p className="mt-2 text-sm text-slate-600">你可以先回灵感广场看看其他方向。</p>
        <Link href="/showcase" className="mt-4 inline-flex text-sm font-bold text-amber-700 hover:text-amber-900">
          返回灵感广场
        </Link>
      </section>
    );
  }

  const likeCount = project.likes + (liked ? 1 : 0);
  const watcherCount = project.watchers + (watching ? 1 : 0);

  return (
    <section className="space-y-6">
      <section className={`overflow-hidden rounded-[32px] border-2 border-slate-100 bg-gradient-to-br ${project.coverGradient} p-5 shadow-sm sm:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-700">{project.category}</span>
            <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-bold text-white">{project.stage}</span>
          </div>
          <p className={`text-xs font-bold sm:text-sm ${project.coverAccentClass}`}>{project.popularityHint}</p>
        </div>

        <div className="mt-4 max-w-3xl">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">{project.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">{project.hook}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">已有收藏</p>
            <p className="mt-2 text-xl font-black text-slate-900">{likeCount} 人</p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">想看后续</p>
            <p className="mt-2 text-xl font-black text-slate-900">{watcherCount} 人</p>
          </div>
          <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">当前建议</p>
            <p className="mt-2 text-base font-bold text-slate-900">{project.judgement}</p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-white/60 bg-white/60 p-4 backdrop-blur-sm">
          <div className="grid gap-3 sm:grid-cols-4">
            {stageSteps.map((step, index) => {
              const active = stageSteps.indexOf(project.stage) >= index;
              const current = project.stage === step;
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

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setLiked((prev) => !prev)}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              liked
                ? "bg-slate-900 text-white shadow-[0_4px_0_0_#0f172a]"
                : "border-2 border-slate-200 bg-white text-slate-700 shadow-[0_4px_0_0_#e2e8f0] hover:border-slate-300"
            }`}
          >
            {liked ? "✓ 收藏这个方向" : "收藏这个方向"}
          </button>
          <button
            type="button"
            onClick={() => setWatching((prev) => !prev)}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
              watching
                ? "bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#d97706]"
                : "border-2 border-amber-200 bg-white text-amber-800 shadow-[0_4px_0_0_#fde68a] hover:bg-amber-50"
            }`}
          >
            {watching ? "✓ 想看后续" : "想看后续"}
          </button>
          <Link
            href={`/quick/new?idea=${encodeURIComponent(`${project.title}，更偏${project.tags[0]}方向`)}`}
            className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all hover:bg-amber-300 active:translate-y-1 active:shadow-none"
          >
            我也试一个类似方向
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <article className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">当前判断</h2>
            <p className="mt-3 text-sm font-bold text-slate-900">{project.judgement}</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{project.whyItWorks}</p>
          </article>
          <article className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">适合谁先试</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">当前更适合：{project.fitFor}</p>
            <p className="mt-3 text-xs leading-6 text-slate-500">更适合人群：{project.audience}</p>
          </article>
          <article className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">当前状态说明</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700">{project.statusExplanation}</p>
            <p className="mt-3 text-xs leading-6 text-slate-500">当前建议：{project.nextSuggestion}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">现在最该注意：{project.caution}</p>
          </article>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border-2 border-blue-100 bg-blue-50/60 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">最近动态</h2>
            <div className="mt-4 space-y-3">
              {project.updates.map((update) => (
                <div key={update} className="rounded-2xl bg-white/85 p-4 text-sm leading-6 text-slate-700 shadow-sm">
                  {update}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border-2 border-amber-100 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">当前建议</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">当前更适合：{project.nextSuggestion}。如果你也想做类似方向，先试一个自己的版本会更快。</p>
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href={`/quick/new?idea=${encodeURIComponent(`${project.title}，更偏${project.tags[0]}方向`)}`}
                className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all hover:bg-amber-300 active:translate-y-1 active:shadow-none"
              >
                我也试一个类似方向
              </Link>
              <Link
                href="/showcase"
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
              >
                看相似灵感
              </Link>
            </div>
          </section>
        </aside>
      </section>

      {related.length > 0 ? (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">你可能也会想看这些方向</h2>
              <p className="mt-2 text-sm text-slate-500">优先给你看同分类和标签更接近的项目。</p>
            </div>
            <Link href="/showcase" className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline">
              回到灵感广场
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
                    我也看看这个方向
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
