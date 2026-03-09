"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  inferNextSuggestionFromJudgement,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapIntentStatusToUnifiedStage
} from "@/lib/project-language";

type IntentListItem = {
  id: string;
  source_type: string;
  status: string;
  priority: string;
  contact_phone_or_wechat: string | null;
  created_at: string;
  updated_at: string;
  latest_snapshot?: {
    project_title?: string | null;
    estimated_total_price_min?: number | null;
    estimated_total_price_max?: number | null;
  } | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export default function IntentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<IntentListItem[]>([]);
  const [filter, setFilter] = useState<"all" | "small_batch" | "professional_upgrade">("all");

  const loadIntents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/intents?limit=50");
      const data = (await res.json().catch(() => null)) as { items?: IntentListItem[]; error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || "我的意向暂时没有读取出来。");
      }
      setItems(data?.items || []);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : "我的意向暂时没有读取出来。";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntents();
  }, [loadIntents]);

  const hasData = useMemo(() => items.length > 0, [items.length]);
  const filteredItems = useMemo(
    () => items.filter((item) => (filter === "all" ? true : item.source_type === filter)),
    [filter, items]
  );

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">我的意向</h1>
          <p className="mt-1 text-sm text-slate-600">这里记录你已经提交过的推进意向，可继续查看当前阶段、所走路径和下一步建议。</p>
        </div>
        <button
          type="button"
          onClick={loadIntents}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {loading ? "正在重新查看..." : "重新看看我的意向"}
        </button>
      </div>

      {error && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
      )}

      {!loading && !hasData && !error && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 text-center text-sm text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">你还没有提交推进意向</h2>
          <p className="mt-2">可以先从方向判断完成页进入试做路径或完整方案路径，先看一个方向值不值得继续推进。</p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/quick/new"
              className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
            >
              先试一个创意
            </Link>
            <Link
              href="/showcase"
              className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
            >
              去灵感广场看看别人怎么推进
            </Link>
          </div>
        </section>
      )}

      {hasData && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "全部意向" },
              { key: "small_batch", label: "试做路径" },
              { key: "professional_upgrade", label: "完整方案路径" }
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as typeof filter)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  filter === item.key
                    ? "border-2 border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                    : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map((item) => (
          <article key={item.id} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-bold text-white">
                {mapIntentStatusToUnifiedStage(item.status)}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {mapIntentSourceTypeToPathLabel(item.source_type)}
              </span>
            </div>
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {item.latest_snapshot?.project_title || "未命名意向项目"}
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-800">{mapIntentSourceTypeToJudgement(item.source_type)}</p>
            <p className="mt-2 text-sm text-slate-600">
              当前建议：{inferNextSuggestionFromJudgement(mapIntentSourceTypeToJudgement(item.source_type))}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                最近更新：{formatDate(item.updated_at)}
              </span>
            </div>
            <div className="mt-4">
              <Link href={`/intents/${item.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                {item.source_type === "small_batch" ? "继续看试做路径" : item.source_type === "professional_upgrade" ? "继续补充完整方案" : "查看这个项目"}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
