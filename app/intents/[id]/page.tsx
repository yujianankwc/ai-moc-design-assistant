"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  parseDeliveryRecordContent,
  formatIntentFollowupSummary,
  getIntentStageProgress,
  getIntentStageSteps,
  inferIntentNextSuggestion,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapIntentStatusToAdminLabel,
  mapIntentToUnifiedStage
} from "@/lib/project-language";

type IntentRecord = {
  id: string;
  project_id: string | null;
  source_type: string;
  status: string;
  contact_phone_or_wechat: string | null;
  created_at: string;
  updated_at: string;
};

type SnapshotRecord = {
  id: string;
  project_title: string | null;
  selected_quantity: number | null;
  package_level: string | null;
  estimated_total_price_min: number | null;
  estimated_total_price_max: number | null;
};

type QuoteRecord = {
  id: string;
  version: number;
  quote_status: string;
  quantity: number;
  final_total_price: number;
  deposit_amount: number;
  package_level: string;
  design_service_level: string;
  final_unit_price: number;
  valid_until: string | null;
  created_at: string;
};

type FollowupRecord = {
  id: string;
  content: string;
  action_type: string;
  from_status?: string | null;
  to_status?: string | null;
  created_at: string;
};

type IntentDetail = {
  intent: IntentRecord;
  snapshots: SnapshotRecord[];
  quotes: QuoteRecord[];
  followups: FollowupRecord[];
};

function shouldSoftFailIntentDetail(message: string) {
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function mapStatusLabel(status: string, sourceType?: string) {
  return mapIntentToUnifiedStage({ status, sourceType });
}

function mapQuoteStatusLabel(status: string) {
  if (status === "draft") return "这版说明还在整理中";
  if (status === "sent") return "这版说明已经发出";
  if (status === "accepted") return "这版说明已经确认";
  if (status === "expired") return "这版说明已过期";
  if (status === "replaced") return "这版说明已被新版本替代";
  if (status === "converted_to_order") return "这版说明已进入后续订单";
  return status;
}

function formatPriceRange(min: number | null | undefined, max: number | null | undefined) {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return "-";
  if (Number.isFinite(min) && Number.isFinite(max)) return `¥${min} - ¥${max}`;
  if (Number.isFinite(min)) return `≥ ¥${min}`;
  return `≤ ¥${max}`;
}

function isDeliveryStatus(status: string | null | undefined) {
  return status === "preparing_delivery" || status === "delivering" || status === "delivered" || status === "closed_won";
}

export default function IntentDetailPage() {
  const params = useParams<{ id: string }>();
  const intentId = params?.id || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<IntentDetail | null>(null);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState("");

  const loadDetail = useCallback(async () => {
    if (!intentId) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/intents/${intentId}`);
      const data = (await res.json().catch(() => null)) as
        | (IntentDetail & { error?: string; temporaryUnavailable?: boolean })
        | null;
      const message = data?.error || "这条推进意向暂时没有读取出来。";

      if (data?.temporaryUnavailable) {
        setDetail(null);
        setNotice("这条意向的详情暂时没有连上服务，稍后再看就可以。");
        return;
      }

      if (!res.ok) {
        if (shouldSoftFailIntentDetail(message)) {
          setDetail(null);
          setNotice("这条意向的详情暂时没有连上服务，稍后再看就可以。");
          return;
        }
        throw new Error(message);
      }
      setDetail(data as IntentDetail);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : "这条推进意向暂时没有读取出来。";
      if (shouldSoftFailIntentDetail(msg)) {
        setDetail(null);
        setNotice("这条意向的详情暂时没有连上服务，稍后再看就可以。");
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const latestSnapshot = detail?.snapshots?.[0] || null;
  const stageIndex = useMemo(
    () => getIntentStageProgress({ status: detail?.intent.status || "new", sourceType: detail?.intent.source_type }),
    [detail?.intent.source_type, detail?.intent.status]
  );
  const stageSteps = useMemo(
    () => getIntentStageSteps({ sourceType: detail?.intent.source_type }),
    [detail?.intent.source_type]
  );
  const latestQuote = detail?.quotes?.[0] || null;
  const judgement = useMemo(() => mapIntentSourceTypeToJudgement(detail?.intent.source_type || "small_batch"), [detail?.intent.source_type]);
  const nextSuggestion = useMemo(
    () => inferIntentNextSuggestion({ sourceType: detail?.intent.source_type || "small_batch", status: detail?.intent.status || "new" }),
    [detail?.intent.source_type, detail?.intent.status]
  );
  const deliveryRecords = useMemo(() => {
    return (detail?.followups || [])
      .filter((item) => {
        if (item.action_type === "delivery_note" || item.action_type === "deposit_submitted") return true;
        return item.action_type === "status_change" && isDeliveryStatus(item.to_status);
      })
      .map((item) => {
        const parsed = parseDeliveryRecordContent(item.content);
        const milestone =
          parsed.milestone ||
          (item.action_type === "deposit_submitted"
            ? "已提交定金凭证"
            : item.to_status
              ? mapIntentStatusToAdminLabel(item.to_status)
              : "交付推进记录");
        const note =
          parsed.note ||
          (item.action_type === "delivery_note"
            ? item.content
            : formatIntentFollowupSummary({
                actionType: item.action_type,
                content: item.content,
                fromStatus: item.from_status,
                toStatus: item.to_status
              }));

        return {
          id: item.id,
          milestone,
          eta: parsed.eta,
          link: parsed.link,
          note,
          createdAt: item.created_at
        };
      });
  }, [detail?.followups]);
  const primaryAction = useMemo(() => {
    if (!detail) return null;
    if (detail.intent.status === "quoted" && latestQuote && (latestQuote.quote_status === "sent" || latestQuote.quote_status === "draft")) {
      return "accept_quote" as const;
    }
    if (detail.intent.status === "deposit_pending") {
      return "submit_deposit" as const;
    }
    if (detail.intent.status === "locked" || detail.intent.status === "preparing_delivery") {
      return "delivery_preparing" as const;
    }
    if (detail.intent.status === "delivering") {
      return "delivery_progress" as const;
    }
    if (detail.intent.status === "delivered" || detail.intent.status === "closed_won") {
      return "delivery_done" as const;
    }
    return null;
  }, [detail, latestQuote]);

  const handleAcceptQuote = async () => {
    if (!latestQuote) return;
    setAcceptingQuoteId(latestQuote.id);
    setFeedback("");
    try {
      const res = await fetch(`/api/quotes/${latestQuote.id}/accept`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "报价确认失败");
      setFeedback("这版报价已确认，当前更适合继续补上定金凭证。");
      await loadDetail();
    } catch (acceptError) {
      const msg = acceptError instanceof Error ? acceptError.message : "报价确认失败";
      setFeedback(msg);
    } finally {
      setAcceptingQuoteId("");
    }
  };

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">这一步</h1>
          <p className="mt-1 text-sm text-slate-600">
            现在到哪一步：{mapStatusLabel(detail?.intent.status || "new", detail?.intent.source_type || "small_batch")} · 这一步是：
            {mapIntentSourceTypeToPathLabel(detail?.intent.source_type || "small_batch")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDetail}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {loading ? "正在重新看看..." : "重新看看"}
          </button>
          <Link href="/projects" className="text-sm text-blue-700 hover:underline">
            回到我的
          </Link>
          {detail?.intent.project_id && (
            <Link href={`/projects/${detail.intent.project_id}`} className="text-sm text-slate-700 hover:underline">
              看这条方向
            </Link>
          )}
        </div>
      </div>

      {error && <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>}
      {feedback && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{feedback}</section>}
      {notice && !error && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</section>}

      {!loading && !detail && !error && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 text-center text-sm text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">这一步暂时还没显示出来</h2>
          <p className="mt-2">可以先回到我的意向列表，稍后再重新打开这条记录。</p>
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/intents"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
            >
              回到我的意向
            </Link>
            <button
              type="button"
              onClick={loadDetail}
              className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
            >
              重新看看
            </button>
          </div>
        </section>
      )}

      {detail && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-bold text-white">
                {mapIntentToUnifiedStage({ status: detail.intent.status, sourceType: detail.intent.source_type })}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {mapIntentSourceTypeToPathLabel(detail.intent.source_type)}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {mapIntentStatusToAdminLabel(detail.intent.status)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">现在是什么阶段</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{mapStatusLabel(detail.intent.status, detail.intent.source_type)}</p>
                <p className="mt-2 text-sm text-slate-700">{judgement}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-700">下一步怎么做</p>
                <p className="mt-1 text-base font-semibold text-amber-950">{nextSuggestion}</p>
                {detail.intent.project_id && (
                  <div className="mt-3">
                    <Link href={`/projects/${detail.intent.project_id}`} className="text-sm font-bold text-amber-800 hover:text-amber-950">
                      回到对应项目继续看
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <h2 className="mt-5 text-base font-semibold text-slate-900">现在走到这里了</h2>
            <div className={`mt-3 grid gap-2 ${stageSteps.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              {stageSteps.map((step, index) => {
                const active = index + 1 <= stageIndex;
                return (
                  <p
                    key={step}
                    className={
                      active
                        ? "rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800"
                        : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
                    }
                  >
                    {step}
                  </p>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">你现在点哪个按钮</h2>
            {primaryAction === "accept_quote" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">如果这版报价说明没有问题，就先确认下来，下一步再补上定金凭证。</p>
                <button
                  type="button"
                  onClick={handleAcceptQuote}
                  disabled={acceptingQuoteId === latestQuote?.id}
                  className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {acceptingQuoteId === latestQuote?.id ? "正在确认这版报价..." : "确认这版报价说明"}
                </button>
              </div>
            )}
            {primaryAction === "submit_deposit" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">补上定金凭证，完成后这条意向会进入更稳定的推进阶段。</p>
                <Link
                  href={`/intents/${intentId}/deposit`}
                  className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  补上定金凭证
                </Link>
              </div>
            )}
            {primaryAction === "delivery_preparing" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">先继续确认交付安排和时间节奏，这条方向已经进入更稳定推进。</p>
                <a href="#delivery-records" className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  查看交付记录
                </a>
              </div>
            )}
            {primaryAction === "delivery_progress" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">继续跟进交付进度和关键节点，这条方向已经进入交付推进中。</p>
                <a href="#delivery-records" className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  查看交付记录
                </a>
              </div>
            )}
            {primaryAction === "delivery_done" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">这条方向已经完成交付，接下来更适合回看整个推进过程，准备下一轮方向。</p>
                <a href="#delivery-records" className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  查看交付记录
                </a>
              </div>
            )}
            {!primaryAction && <p className="mt-3 text-sm text-slate-600">当前这一步已经记录好了，继续看当前阶段和最近推进记录就够了。</p>}
          </section>

          {latestSnapshot && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">这一步记下了什么</h2>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">数量：{latestSnapshot.selected_quantity || "-"}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">包装：{latestSnapshot.package_level || "-"}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  总价区间：{formatPriceRange(latestSnapshot.estimated_total_price_min, latestSnapshot.estimated_total_price_max)}
                </p>
              </div>
              <p className="mt-3 text-xs text-slate-500">项目：{latestSnapshot.project_title || "-"}</p>
            </section>
          )}

          {latestQuote && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">当前报价说明</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">状态：{mapQuoteStatusLabel(latestQuote.quote_status)}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">总价：¥{latestQuote.final_total_price}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">定金：¥{latestQuote.deposit_amount}</p>
              </div>
            </section>
          )}

          {(deliveryRecords.length > 0 || isDeliveryStatus(detail.intent.status) || detail.intent.status === "locked") && (
            <section id="delivery-records" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">交付记录</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {mapIntentStatusToAdminLabel(detail.intent.status)}
                </span>
              </div>

              {deliveryRecords.length === 0 ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">当前还没有新的交付记录</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {deliveryRecords.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.milestone}</p>
                        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">最近发生了什么</h2>
            {detail.followups.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">这里还没有新的推进记录，可以先继续看当前阶段和下一步建议。</p>
            ) : (
              <div className="mt-3 space-y-3">
                {detail.followups.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {formatIntentFollowupSummary({
                        actionType: item.action_type,
                        content: item.content,
                        fromStatus: item.from_status,
                        toStatus: item.to_status
                      })}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
