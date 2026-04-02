"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  inferIntentNextSuggestion,
  inferProgressOwnerHint,
  mapIntentToUnifiedStage,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel
} from "@/lib/project-language";

type IntentListItem = {
  id: string;
  project_id: string | null;
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
  latest_followup?: {
    action_type?: string | null;
    content?: string | null;
    from_status?: string | null;
    to_status?: string | null;
    created_at?: string | null;
  } | null;
  latest_quote_status?: string | null;
  latest_quote_version?: number | null;
};

type SignalFilter = "all" | "quoted" | "deposit_pending" | "locked";

function shouldSoftFailIntentList(message: string) {
  const normalized = message.toLowerCase();
  return (
    message.includes("演示用户初始化失败") ||
    message.includes("缺少 Supabase 环境变量") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout")
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export default function IntentsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<IntentListItem[]>([]);
  const [pathFilter, setPathFilter] = useState<"all" | "small_batch" | "pro_upgrade" | "crowdfunding">("all");
  const [signalFilter] = useState<SignalFilter>("all");

  const loadIntents = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/intents?limit=50");
      const data = (await res.json().catch(() => null)) as
        | { items?: IntentListItem[]; error?: string; fallback?: boolean }
        | null;
      const message = data?.error || "我的意向暂时没有读取出来。";

      if (data?.fallback) {
        setItems(data.items || []);
        setNotice("当前意向列表暂时没有连上服务，先不影响你继续看其它页面。");
        return;
      }

      if (!res.ok) {
        if (shouldSoftFailIntentList(message)) {
          setItems([]);
          setNotice("当前意向列表暂时没有连上服务，先不影响你继续看其它页面。");
          return;
        }
        throw new Error(message);
      }
      setItems(data?.items || []);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : "我的意向暂时没有读取出来。";
      if (shouldSoftFailIntentList(msg)) {
        setItems([]);
        setNotice("当前意向列表暂时没有连上服务，先不影响你继续看其它页面。");
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntents();
  }, [loadIntents]);

  const hasData = useMemo(() => items.length > 0, [items.length]);
  const summary = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const stageA = mapIntentToUnifiedStage({ status: a.status, sourceType: a.source_type }) === "已提交意向" ? 1 : 0;
      const stageB = mapIntentToUnifiedStage({ status: b.status, sourceType: b.source_type }) === "已提交意向" ? 1 : 0;
      if (stageA !== stageB) return stageB - stageA;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return {
      total: items.length,
      recommended: sorted[0] || null
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const pathMatched = pathFilter === "all" ? true : item.source_type === pathFilter;
      const signalMatched =
        signalFilter === "all"
          ? true
          : signalFilter === "quoted"
            ? item.latest_quote_status === "draft" || item.latest_quote_status === "sent"
            : signalFilter === "deposit_pending"
              ? item.status === "deposit_pending" || item.latest_quote_status === "accepted"
              : ["locked", "preparing_delivery", "delivering", "delivered", "closed_won"].includes(item.status);
      return pathMatched && signalMatched;
    });
  }, [items, pathFilter, signalFilter]);

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">我的下一步</h1>
          <p className="mt-1 text-sm text-slate-600">这里记录你已经记下来的下一步。只看现在到哪一步，以及接下来点哪里。</p>
        </div>
        <button
          type="button"
          onClick={loadIntents}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {loading ? "正在重新查看..." : "重新看看"}
        </button>
      </div>

      {error && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
      )}

      {notice && !error && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</section>
      )}

      {!loading && !hasData && !error && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 text-center text-sm text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">你还没有记下要继续做的步骤</h2>
          <p className="mt-2">先试一个方向，选好下一步，这里就会出现。</p>
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
              去看看别人怎么玩
            </Link>
          </div>
        </section>
      )}

      {hasData && (
        <>
          <section className="rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
              <p className="text-xs font-bold tracking-[0.2em] text-amber-700">现在最适合先做这个</p>
              {summary.recommended ? (
                <>
                  <h2 className="mt-3 text-lg font-bold text-slate-900">
                    {summary.recommended.latest_snapshot?.project_title || "未命名意向项目"}
                  </h2>
                  <p className="mt-2 text-sm font-bold text-slate-800">
                    {mapIntentSourceTypeToJudgement(summary.recommended.source_type)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {inferIntentNextSuggestion({
                      sourceType: summary.recommended.source_type,
                      status: summary.recommended.status
                    })}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-amber-900">
                    {inferProgressOwnerHint({
                      stage: mapIntentToUnifiedStage({
                        status: summary.recommended.status,
                        sourceType: summary.recommended.source_type
                      }),
                      nextSuggestion: inferIntentNextSuggestion({
                        sourceType: summary.recommended.source_type,
                        status: summary.recommended.status
                      })
                    })}
                  </p>
                  <Link
                    href={`/intents/${summary.recommended.id}`}
                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
                  >
                    去看这一步
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">先试一个方向，后续这里会帮你提示更适合优先推进的项目。</p>
              )}
          </section>

          <section className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-500">其它步骤</span>
              {[
                { key: "all", label: "全部" },
                { key: "small_batch", label: "先试做" },
                { key: "pro_upgrade", label: "继续完善" },
                { key: "crowdfunding", label: "发布出来看看" }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPathFilter(item.key as typeof pathFilter)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    pathFilter === item.key
                      ? "border-2 border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                      : "border-2 border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {hasData && filteredItems.length === 0 && (
        <section className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">这里还没有符合当前筛选的推进记录</h2>
          <p className="mt-2">可以先换一个路径看看，或者先从一个方向判断开始，再决定往哪条路径继续推进。</p>
          <Link
            href="/quick/new"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
          >
            先试一个创意
          </Link>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filteredItems.map((item) => {
          const judgement = mapIntentSourceTypeToJudgement(item.source_type);
          const nextSuggestion = inferIntentNextSuggestion({ sourceType: item.source_type, status: item.status });
          const stage = mapIntentToUnifiedStage({ status: item.status, sourceType: item.source_type });

          return (
            <article key={item.id} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-bold text-white">{stage}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  {mapIntentSourceTypeToPathLabel(item.source_type)}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                {item.latest_snapshot?.project_title || "未命名意向项目"}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-800">{nextSuggestion}</p>
              <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">现在到哪一步了</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{stage}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">这是什么方向</p>
                <p className="mt-1 text-sm text-slate-700">{judgement}</p>
                <p className="mt-3 text-xs text-slate-500">
                  最近更新：{formatDate(item.latest_followup?.created_at || item.updated_at)}
                </p>
              </div>
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/intents/${item.id}`} className="text-sm font-medium text-blue-700 hover:text-blue-800">
                    去看这一步
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
