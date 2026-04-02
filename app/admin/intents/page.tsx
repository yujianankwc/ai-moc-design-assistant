"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatDeliveryRecordContent,
  getIntentStatusExplanation,
  mapIntentToUnifiedStage,
  mapIntentSourceTypeToJudgement,
  mapIntentSourceTypeToPathLabel,
  mapIntentStatusToAdminLabel
} from "@/lib/project-language";

type IntentListItem = {
  id: string;
  source_type: string;
  status: string;
  priority: string;
  contact_name: string | null;
  contact_phone_or_wechat: string | null;
  created_at: string;
  latest_snapshot?: {
    project_title?: string | null;
    estimated_total_price_min?: number | null;
    estimated_total_price_max?: number | null;
  } | null;
};

type IntentDetail = {
  intent: Record<string, unknown>;
  snapshots: Array<Record<string, unknown>>;
  followups: Array<Record<string, unknown>>;
  quotes: Array<Record<string, unknown>>;
};

const TOKEN_KEY = "moc_admin_api_token_v1";

function toText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : 0;
}

function AdminIntentsPageContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [keyword, setKeyword] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [items, setItems] = useState<IntentListItem[]>([]);

  const [selectedIntentId, setSelectedIntentId] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState<IntentDetail | null>(null);

  const [statusToUpdate, setStatusToUpdate] = useState("contact_pending");
  const [statusNote, setStatusNote] = useState("");

  const [followupType, setFollowupType] = useState("note");
  const [followupContent, setFollowupContent] = useState("");
  const [deliveryMilestone, setDeliveryMilestone] = useState("");
  const [deliveryEta, setDeliveryEta] = useState("");
  const [deliveryLink, setDeliveryLink] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteQuantity, setQuoteQuantity] = useState(50);
  const [quotePackageLevel, setQuotePackageLevel] = useState("standard_gift");
  const [quoteDesignServiceLevel, setQuoteDesignServiceLevel] = useState("design_optimize");
  const [quoteUnitPrice, setQuoteUnitPrice] = useState(199);
  const [quoteTotalPrice, setQuoteTotalPrice] = useState(9950);
  const [quoteDesignFee, setQuoteDesignFee] = useState(399);
  const [quoteDiscountAmount, setQuoteDiscountAmount] = useState(199);
  const [quoteDepositAmount, setQuoteDepositAmount] = useState(1999);
  const [quoteNote, setQuoteNote] = useState("");
  const [quoteStatusToUpdate, setQuoteStatusToUpdate] = useState("sent");

  const [actionFeedback, setActionFeedback] = useState("");

  const queryIntentId = searchParams.get("intentId") || "";
  const querySourceType = searchParams.get("sourceType") || "";
  const queryStatus = searchParams.get("status") || "";
  const queryKeyword = searchParams.get("keyword") || "";

  useEffect(() => {
    const cached = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(cached);
  }, []);

  useEffect(() => {
    if (querySourceType) setSourceFilter(querySourceType);
    if (queryStatus) setStatusFilter(queryStatus);
    if (queryKeyword) setKeyword(queryKeyword);
    if (queryIntentId) setSelectedIntentId(queryIntentId);
  }, [queryIntentId, queryKeyword, querySourceType, queryStatus]);

  const listSummary = useMemo(() => {
    return {
      total: items.length,
      quoted: items.filter((item) => item.status === "quoted").length,
      depositPending: items.filter((item) => item.status === "deposit_pending").length,
      locked: items.filter((item) =>
        ["locked", "preparing_delivery", "delivering", "delivered", "closed_won"].includes(item.status)
      ).length
    };
  }, [items]);

  const headers = useMemo(() => {
    const base: HeadersInit = { "Content-Type": "application/json" };
    if (token.trim()) {
      base["x-admin-token"] = token.trim();
    }
    return base;
  }, [token]);

  const saveToken = () => {
    window.localStorage.setItem(TOKEN_KEY, token.trim());
    setActionFeedback("管理端口令已经先记在当前浏览器里。");
  };

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    setActionFeedback("");
    try {
      const params = new URLSearchParams();
      if (statusFilter.trim()) params.set("status", statusFilter.trim());
      if (sourceFilter.trim()) params.set("sourceType", sourceFilter.trim());
      if (keyword.trim()) params.set("keyword", keyword.trim());
      params.set("limit", "50");
      const res = await fetch(`/api/admin/intents?${params.toString()}`, { headers });
      const data = (await res.json().catch(() => null)) as
        | { items?: IntentListItem[]; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error || "推进意向列表暂时没有读取出来");
      }
      setItems(data?.items || []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "推进意向列表暂时没有读取出来";
      setListError(msg);
    } finally {
      setLoadingList(false);
    }
  }, [headers, keyword, sourceFilter, statusFilter]);

  const loadDetail = useCallback(async (intentId: string) => {
    if (!intentId) return;
    setSelectedIntentId(intentId);
    setLoadingDetail(true);
    setDetailError("");
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${intentId}`, { headers });
      const data = (await res.json().catch(() => null)) as (IntentDetail & { error?: string }) | null;
      if (!res.ok) {
        throw new Error(data?.error || "这条推进意向暂时没有读取出来");
      }
      setDetail(data as IntentDetail);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "这条推进意向暂时没有读取出来";
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!token.trim()) return;
    if (!queryIntentId && !querySourceType && !queryStatus && !queryKeyword) return;
    void loadList();
  }, [loadList, queryIntentId, queryKeyword, querySourceType, queryStatus, token]);

  useEffect(() => {
    if (!token.trim() || !queryIntentId) return;
    void loadDetail(queryIntentId);
  }, [loadDetail, queryIntentId, token]);

  const updateStatus = async () => {
    if (!selectedIntentId) return;
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${selectedIntentId}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          toStatus: statusToUpdate,
          note: statusNote
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "状态更新失败");
      setActionFeedback("这条推进意向的当前阶段已经更新。");
      await loadDetail(selectedIntentId);
      await loadList();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "这一步暂时没有更新成功";
      setActionFeedback(msg);
    }
  };

  const appendFollowup = async () => {
    if (!selectedIntentId) return;
    if (!followupContent.trim()) {
      setActionFeedback("请先补一条推进记录。");
      return;
    }
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${selectedIntentId}/followups`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          actionType: followupType,
          content: followupContent.trim()
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "追加跟进失败");
      setFollowupContent("");
      setActionFeedback("最近推进记录已经记下来了。");
      await loadDetail(selectedIntentId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "这条推进记录暂时没有记下来";
      setActionFeedback(msg);
    }
  };

  const appendDeliveryRecord = async () => {
    if (!selectedIntentId) return;
    const content = formatDeliveryRecordContent({
      milestone: deliveryMilestone,
      eta: deliveryEta,
      note: deliveryNote,
      link: deliveryLink
    });
    if (!content) {
      setActionFeedback("请先补充至少一项交付信息。");
      return;
    }
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${selectedIntentId}/followups`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          actionType: "delivery_note",
          content
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "交付记录暂时没有记下来");
      setDeliveryMilestone("");
      setDeliveryEta("");
      setDeliveryLink("");
      setDeliveryNote("");
      setActionFeedback("交付记录已经记下来了。");
      await loadDetail(selectedIntentId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "交付记录暂时没有记下来";
      setActionFeedback(msg);
    }
  };

  const createQuote = async () => {
    if (!selectedIntentId) return;
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${selectedIntentId}/quotes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          validUntil: quoteValidUntil || null,
          quantity: quoteQuantity,
          packageLevel: quotePackageLevel,
          designServiceLevel: quoteDesignServiceLevel,
          finalUnitPrice: quoteUnitPrice,
          finalTotalPrice: quoteTotalPrice,
          designFee: quoteDesignFee,
          discountAmount: quoteDiscountAmount,
          depositAmount: quoteDepositAmount,
          deliveryNote: quoteNote
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "创建报价失败");
      setActionFeedback("这版报价说明已经记下来了。");
      await loadDetail(selectedIntentId);
      await loadList();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "这版报价说明暂时没有记下来";
      setActionFeedback(msg);
    }
  };

  const updateLatestQuoteStatus = async () => {
    const latestQuoteId = toText(detail?.quotes?.[0]?.id);
    if (!latestQuoteId) {
      setActionFeedback("当前还没有可更新的报价说明。");
      return;
    }
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/quotes/${latestQuoteId}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          toStatus: quoteStatusToUpdate,
          note: `报价说明状态更新为 ${quoteStatusToUpdate}`
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "报价状态更新失败");
      setActionFeedback("这版报价说明的状态已经更新。");
      await loadDetail(selectedIntentId);
      await loadList();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "报价状态更新失败";
      setActionFeedback(msg);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">推进意向中台</h1>
            <p className="mt-1 text-sm text-slate-600">这里先承接测试期的推进意向、最近跟进和报价说明，方便内部把方向继续往下推进。</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/projects" className="font-medium text-blue-700 hover:underline">
              查看项目总览中台
            </Link>
            <Link href="/admin/showcase" className="font-medium text-violet-700 hover:underline">
              查看公开展示运营中台
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="请输入 x-admin-token（服务端必须已配置 ADMIN_API_TOKEN）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xl"
          />
          <button
            type="button"
            onClick={saveToken}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            保存 Token
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">当前列表总数</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{listSummary.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">已给出报价说明</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{listSummary.quoted}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">等待补定金凭证</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">{listSummary.depositPending}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">已进入更稳定推进</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{listSummary.locked}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
            {[
              { key: "", label: "全部推进信号" },
              { key: "quoted", label: "已报价说明" },
              { key: "deposit_pending", label: "待继续补定金" },
              { key: "locked", label: "已进入更稳定推进" }
            ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                statusFilter === item.key
                  ? "border-2 border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm"
                  : "border-2 border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">推进意向筛选</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部阶段</option>
                <option value="new">刚记下推进意向</option>
                <option value="contact_pending">等待进一步沟通</option>
                <option value="contacted">已完成第一轮沟通</option>
                <option value="confirming">正在确认路径细节</option>
                <option value="quoted">已给出报价说明</option>
                <option value="deposit_pending">等待补定金凭证</option>
                <option value="locked">已进入锁单推进</option>
                <option value="preparing_delivery">正在准备交付</option>
                <option value="delivering">正在继续交付</option>
                <option value="delivered">已完成交付</option>
                <option value="closed_won">已进入后续交付</option>
                <option value="closed_lost">暂时停止推进</option>
              </select>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部路径</option>
                <option value="small_batch">试做路径</option>
                <option value="pro_upgrade">完整方案路径</option>
                <option value="crowdfunding">公开展示路径</option>
              </select>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="关键词（编号 / 联系方式）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <button
              type="button"
              onClick={loadList}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {loadingList ? "正在重新看看..." : "重新看看推进意向"}
            </button>
            {listError && <p className="mt-2 text-xs text-rose-600">{listError}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">推进意向列表</h2>
            <div className="mt-3 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">这里还没有推进记录，可以先调整筛选条件再看看。</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadDetail(item.id)}
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedIntentId === item.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-xs text-slate-500">{item.id}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.latest_snapshot?.project_title || "未命名意向"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-white">
                        {mapIntentToUnifiedStage({ status: item.status, sourceType: item.source_type })}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        {mapIntentSourceTypeToPathLabel(item.source_type)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-700">{mapIntentStatusToAdminLabel(item.status)}</p>
                    <p className="mt-1 text-xs text-slate-600">{mapIntentSourceTypeToJudgement(item.source_type)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      联系：{item.contact_phone_or_wechat || "-"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">当前推进意向</h2>
            {loadingDetail ? (
              <p className="mt-2 text-sm text-slate-500">正在整理这条推进意向...</p>
            ) : detailError ? (
              <p className="mt-2 text-sm text-rose-600">{detailError}</p>
            ) : !detail ? (
              <p className="mt-2 text-sm text-slate-500">先从左侧选一条推进意向，这里会显示当前阶段、路径和下一步建议。</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-bold text-white">
                      {mapIntentToUnifiedStage({
                        status: toText(detail.intent.status),
                        sourceType: toText(detail.intent.source_type)
                      })}
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                      {mapIntentSourceTypeToPathLabel(toText(detail.intent.source_type))}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {mapIntentSourceTypeToJudgement(toText(detail.intent.source_type))}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {getIntentStatusExplanation({ status: toText(detail.intent.status), sourceType: toText(detail.intent.source_type) })}
                  </p>
                  <p className="mt-3 text-xs text-slate-600">联系方式：{toText(detail.intent.contact_phone_or_wechat) || "-"}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-900">当前提交内容</h3>
                  {detail.snapshots.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">这里还没有当前快照。</p>
                  ) : (
                    <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <p>项目：{toText(detail.snapshots[0].project_title)}</p>
                      <p>数量：{toNumber(detail.snapshots[0].selected_quantity) || "-"}</p>
                      <p>包装：{toText(detail.snapshots[0].package_level) || "-"}</p>
                      <p>设计：{toText(detail.snapshots[0].design_service_level) || "-"}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-900">当前报价说明</h3>
                  {detail.quotes.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">当前还没有报价说明。</p>
                  ) : (
                    <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <p>版本：v{toNumber(detail.quotes[0].version)}</p>
                      <p>状态：{toText(detail.quotes[0].quote_status) || "-"}</p>
                      <p>总价：¥{toNumber(detail.quotes[0].final_total_price) || 0}</p>
                      <p>定金：¥{toNumber(detail.quotes[0].deposit_amount) || 0}</p>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select value={statusToUpdate} onChange={(event) => setStatusToUpdate(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="contact_pending">等待进一步沟通</option>
                    <option value="contacted">已完成第一轮沟通</option>
                    <option value="confirming">正在确认路径细节</option>
                    <option value="quoted">已给出报价说明</option>
                    <option value="deposit_pending">等待补定金凭证</option>
                    <option value="locked">已进入锁单推进</option>
                    <option value="preparing_delivery">正在准备交付</option>
                    <option value="delivering">正在继续交付</option>
                    <option value="delivered">已完成交付</option>
                    <option value="closed_won">已进入后续交付</option>
                    <option value="closed_lost">暂时停止推进</option>
                  </select>
                  <button
                    type="button"
                    onClick={updateStatus}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    记下当前阶段
                  </button>
                </div>
                <input
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="补一句当前阶段说明（可选）"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">追加最近推进记录</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr]">
              <select value={followupType} onChange={(event) => setFollowupType(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="note">补充说明</option>
                <option value="contact">沟通记录</option>
                <option value="quote">报价相关</option>
                <option value="delivery_note">交付推进</option>
                <option value="risk">风险提醒</option>
              </select>
              <input
                value={followupContent}
                onChange={(event) => setFollowupContent(event.target.value)}
                placeholder="例如：已确认试做数量，等待用户决定是否继续"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={appendFollowup}
              className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              记下这条推进记录
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">记录交付节点</h2>
            <p className="mt-1 text-sm text-slate-600">当项目进入锁单后，可以在这里补充准备交付、交付中和已完成阶段的具体节点。</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={deliveryMilestone}
                onChange={(event) => setDeliveryMilestone(event.target.value)}
                placeholder="交付节点，例如：确认出图排期"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={deliveryEta}
                onChange={(event) => setDeliveryEta(event.target.value)}
                placeholder="预计时间，例如：3 月 18 日前"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={deliveryLink}
                onChange={(event) => setDeliveryLink(event.target.value)}
                placeholder="交付链接（可选）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                placeholder="补充说明，例如：已确认零件清单，正在整理最终交付包"
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <button
              type="button"
              onClick={appendDeliveryRecord}
              className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              记下交付节点
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">整理一版报价说明</h2>
            <p className="mt-1 text-sm text-slate-600">这一步会把当前路径下的数量、包装和设计服务整理成一版可继续沟通的报价说明。</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={String(quoteQuantity)}
                onChange={(event) => setQuoteQuantity(Number(event.target.value || 0))}
                placeholder="数量"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={quotePackageLevel}
                onChange={(event) => setQuotePackageLevel(event.target.value)}
                placeholder="包装等级"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={quoteDesignServiceLevel}
                onChange={(event) => setQuoteDesignServiceLevel(event.target.value)}
                placeholder="设计服务"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={String(quoteUnitPrice)}
                onChange={(event) => setQuoteUnitPrice(Number(event.target.value || 0))}
                placeholder="单价"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={String(quoteTotalPrice)}
                onChange={(event) => setQuoteTotalPrice(Number(event.target.value || 0))}
                placeholder="总价"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={String(quoteDepositAmount)}
                onChange={(event) => setQuoteDepositAmount(Number(event.target.value || 0))}
                placeholder="定金"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={String(quoteDesignFee)}
                onChange={(event) => setQuoteDesignFee(Number(event.target.value || 0))}
                placeholder="设计费"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={String(quoteDiscountAmount)}
                onChange={(event) => setQuoteDiscountAmount(Number(event.target.value || 0))}
                placeholder="减免"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={quoteValidUntil}
                onChange={(event) => setQuoteValidUntil(event.target.value)}
                placeholder="有效期（可选）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={quoteNote}
                onChange={(event) => setQuoteNote(event.target.value)}
                placeholder="这版报价说明的补充备注（可选）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <button
              type="button"
              onClick={createQuote}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              记下这版报价说明
            </button>
            {actionFeedback && <p className="mt-2 text-xs text-emerald-700">{actionFeedback}</p>}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-medium text-slate-900">更新当前报价说明状态</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select value={quoteStatusToUpdate} onChange={(event) => setQuoteStatusToUpdate(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                  <option value="draft">草稿</option>
                  <option value="sent">已发送</option>
                  <option value="accepted">已确认</option>
                  <option value="expired">已过期</option>
                  <option value="replaced">已替换</option>
                  <option value="converted_to_order">已转订单</option>
                </select>
                <button
                  type="button"
                  onClick={updateLatestQuoteStatus}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  记下报价说明状态
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default function AdminIntentsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500 sm:px-6">正在加载推进意向中台...</main>}>
      <AdminIntentsPageContent />
    </Suspense>
  );
}
