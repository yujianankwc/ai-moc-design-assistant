"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { mapIntentSourceTypeToPathLabel, mapIntentStatusToUnifiedStage } from "@/lib/project-language";

type IntentRecord = {
  id: string;
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
  created_at: string;
};

type IntentDetail = {
  intent: IntentRecord;
  snapshots: SnapshotRecord[];
  quotes: QuoteRecord[];
  followups: FollowupRecord[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function mapStatusLabel(status: string) {
  return mapIntentStatusToUnifiedStage(status);
}

function mapQuoteStatusLabel(status: string) {
  if (status === "draft") return "草稿";
  if (status === "sent") return "已发送";
  if (status === "accepted") return "已确认";
  if (status === "expired") return "已过期";
  if (status === "replaced") return "已替换";
  if (status === "converted_to_order") return "已转订单";
  return status;
}

function stageIndexByStatus(status: string) {
  if (status === "locked" || status === "closed_won") return 3;
  if (status === "deposit_pending" || status === "quoted") return 3;
  return 2;
}

function formatPriceRange(min: number | null | undefined, max: number | null | undefined) {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return "-";
  if (Number.isFinite(min) && Number.isFinite(max)) return `¥${min} - ¥${max}`;
  if (Number.isFinite(min)) return `≥ ¥${min}`;
  return `≤ ¥${max}`;
}

export default function IntentDetailPage() {
  const params = useParams<{ id: string }>();
  const intentId = params?.id || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [detail, setDetail] = useState<IntentDetail | null>(null);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState("");
  const [showSnapshotDetails, setShowSnapshotDetails] = useState(false);
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const [showFollowups, setShowFollowups] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!intentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/intents/${intentId}`);
      const data = (await res.json().catch(() => null)) as (IntentDetail & { error?: string }) | null;
      if (!res.ok) throw new Error(data?.error || "这条推进意向暂时没有读取出来。");
      setDetail(data as IntentDetail);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : "这条推进意向暂时没有读取出来。";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const latestSnapshot = detail?.snapshots?.[0] || null;
  const stageIndex = useMemo(() => stageIndexByStatus(detail?.intent.status || "new"), [detail?.intent.status]);
  const latestQuote = detail?.quotes?.[0] || null;
  const primaryAction = useMemo(() => {
    if (!detail) return null;
    if (detail.intent.status === "quoted" && latestQuote && (latestQuote.quote_status === "sent" || latestQuote.quote_status === "draft")) {
      return "accept_quote" as const;
    }
    if (detail.intent.status === "deposit_pending") {
      return "submit_deposit" as const;
    }
    if (detail.intent.status === "locked") {
      return "followup_placeholder" as const;
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
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">推进意向详情</h1>
          <p className="mt-1 text-sm text-slate-600">
            当前阶段：{mapStatusLabel(detail?.intent.status || "new")} · 当前路径：{mapIntentSourceTypeToPathLabel(detail?.intent.source_type || "small_batch")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDetail}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {loading ? "正在重新看看..." : "重新看看这条意向"}
          </button>
          <Link href="/intents" className="text-sm text-blue-700 hover:underline">
            返回列表
          </Link>
        </div>
      </div>

      {error && <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>}
      {feedback && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{feedback}</section>}

      {detail && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">推进阶段</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {["创意已生成", "方向判断完成", "已提交意向", "公开展示中"].map((step, index) => {
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
            <h2 className="text-base font-semibold text-slate-900">当前任务</h2>
            {primaryAction === "accept_quote" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">当前建议：先确认这版报价，确认后再继续补上定金凭证。</p>
                <button
                  type="button"
                  onClick={handleAcceptQuote}
                  disabled={acceptingQuoteId === latestQuote?.id}
                  className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {acceptingQuoteId === latestQuote?.id ? "确认中..." : "确认报价"}
                </button>
              </div>
            )}
            {primaryAction === "submit_deposit" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">当前建议：继续补上定金凭证，完成后这条意向会进入锁单阶段。</p>
                <Link
                  href={`/intents/${intentId}/deposit`}
                  className="mt-3 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  提交定金凭证
                </Link>
              </div>
            )}
            {primaryAction === "followup_placeholder" && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">已锁单，正在安排后续交付节奏。</p>
                <button
                  type="button"
                  onClick={() => setFeedback("交付安排将在下一版接入，这里先做占位。")}
                  className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  查看后续安排
                </button>
              </div>
            )}
            {!primaryAction && <p className="mt-3 text-sm text-slate-600">当前无需你操作，等待人工处理即可。</p>}
          </section>

          {latestSnapshot && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">当前提交内容</h2>
                <button
                  type="button"
                  onClick={() => setShowSnapshotDetails((prev) => !prev)}
                  className="text-xs text-slate-600 hover:underline"
                >
                  {showSnapshotDetails ? "收起" : "展开快照内容"}
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">数量：{latestSnapshot.selected_quantity || "-"}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">包装：{latestSnapshot.package_level || "-"}</p>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  总价区间：{formatPriceRange(latestSnapshot.estimated_total_price_min, latestSnapshot.estimated_total_price_max)}
                </p>
              </div>
              {showSnapshotDetails && (
                <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  项目：{latestSnapshot.project_title || "-"}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">当前报价说明</h2>
              <button
                type="button"
                onClick={() => setShowQuoteDetails((prev) => !prev)}
                className="text-xs text-slate-600 hover:underline"
              >
                {showQuoteDetails ? "收起" : "展开报价说明"}
              </button>
            </div>
            {!latestQuote ? (
              <p className="mt-3 text-sm text-slate-500">当前还没有报价单。</p>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">状态：{mapQuoteStatusLabel(latestQuote.quote_status)}</p>
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">总价：¥{latestQuote.final_total_price}</p>
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">定金：¥{latestQuote.deposit_amount}</p>
                </div>
                {showQuoteDetails && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">数量：{latestQuote.quantity}</p>
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">单价：¥{latestQuote.final_unit_price}</p>
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">包装：{latestQuote.package_level}</p>
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">设计：{latestQuote.design_service_level}</p>
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">有效期：{formatDate(latestQuote.valid_until)}</p>
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">创建：{formatDate(latestQuote.created_at)}</p>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">最近推进记录</h2>
              <button
                type="button"
                onClick={() => setShowFollowups((prev) => !prev)}
                className="text-xs text-slate-600 hover:underline"
              >
                {showFollowups ? "收起" : "展开推进记录"}
              </button>
            </div>
            {!showFollowups ? (
              <p className="mt-3 text-sm text-slate-500">默认折叠，避免信息过载。</p>
            ) : detail.followups.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">暂无跟进记录。</p>
            ) : (
              <div className="mt-3 space-y-2">
                {detail.followups.map((item) => (
                  <div key={item.id} className="rounded-md bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-900">{item.content || item.action_type}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{formatDate(item.created_at)}</p>
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
