"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function AdminIntentsPage() {
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

  const [actionFeedback, setActionFeedback] = useState("");

  useEffect(() => {
    const cached = window.localStorage.getItem(TOKEN_KEY) || "";
    setToken(cached);
  }, []);

  const headers = useMemo(() => {
    const base: HeadersInit = { "Content-Type": "application/json" };
    if (token.trim()) {
      base["x-admin-token"] = token.trim();
    }
    return base;
  }, [token]);

  const saveToken = () => {
    window.localStorage.setItem(TOKEN_KEY, token.trim());
    setActionFeedback("已保存管理端 Token（仅当前浏览器）。");
  };

  const loadList = async () => {
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
        throw new Error(data?.error || "意向单列表读取失败");
      }
      setItems(data?.items || []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "意向单列表读取失败";
      setListError(msg);
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (intentId: string) => {
    if (!intentId) return;
    setSelectedIntentId(intentId);
    setLoadingDetail(true);
    setDetailError("");
    setActionFeedback("");
    try {
      const res = await fetch(`/api/admin/intents/${intentId}`, { headers });
      const data = (await res.json().catch(() => null)) as (IntentDetail & { error?: string }) | null;
      if (!res.ok) {
        throw new Error(data?.error || "意向单详情读取失败");
      }
      setDetail(data as IntentDetail);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "意向单详情读取失败";
      setDetailError(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

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
      setActionFeedback("状态已更新。");
      await loadDetail(selectedIntentId);
      await loadList();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "状态更新失败";
      setActionFeedback(msg);
    }
  };

  const appendFollowup = async () => {
    if (!selectedIntentId) return;
    if (!followupContent.trim()) {
      setActionFeedback("请先填写跟进内容。");
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
      setActionFeedback("跟进记录已追加。");
      await loadDetail(selectedIntentId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "追加跟进失败";
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
      setActionFeedback("报价单已创建（draft）。");
      await loadDetail(selectedIntentId);
      await loadList();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "创建报价失败";
      setActionFeedback(msg);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">意向单 / 报价单中台（MVP）</h1>
        <p className="mt-1 text-sm text-slate-600">仅使用本项目 API，先跑通线索承接、状态跟进、报价创建闭环。</p>
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

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">意向单筛选</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                placeholder="状态（如 new / quoted）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
                placeholder="来源（small_batch / crowdfunding / pro_upgrade）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="关键词（编号/联系方式）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <button
              type="button"
              onClick={loadList}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {loadingList ? "加载中..." : "查询意向单"}
            </button>
            {listError && <p className="mt-2 text-xs text-rose-600">{listError}</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">意向单列表</h2>
            <div className="mt-3 space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">暂无数据，请先查询。</p>
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
                    <p className="mt-1 text-xs text-slate-600">
                      来源：{item.source_type} ｜ 状态：{item.status}
                    </p>
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
            <h2 className="text-base font-semibold text-slate-900">意向单详情</h2>
            {loadingDetail ? (
              <p className="mt-2 text-sm text-slate-500">详情加载中...</p>
            ) : detailError ? (
              <p className="mt-2 text-sm text-rose-600">{detailError}</p>
            ) : !detail ? (
              <p className="mt-2 text-sm text-slate-500">请选择左侧一条意向单。</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                  <p>状态：{toText(detail.intent.status)}</p>
                  <p>来源：{toText(detail.intent.source_type)}</p>
                  <p>联系方式：{toText(detail.intent.contact_phone_or_wechat)}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-900">最新快照</h3>
                  {detail.snapshots.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">暂无快照</p>
                  ) : (
                    <div className="mt-2 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                      <p>项目：{toText(detail.snapshots[0].project_title)}</p>
                      <p>数量：{toNumber(detail.snapshots[0].selected_quantity) || "-"}</p>
                      <p>包装：{toText(detail.snapshots[0].package_level) || "-"}</p>
                      <p>设计：{toText(detail.snapshots[0].design_service_level) || "-"}</p>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={statusToUpdate}
                    onChange={(event) => setStatusToUpdate(event.target.value)}
                    placeholder="toStatus（quoted / deposit_pending ...）"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={updateStatus}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    更新状态
                  </button>
                </div>
                <input
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="状态备注（可选）"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">追加跟进</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-[220px_1fr]">
              <input
                value={followupType}
                onChange={(event) => setFollowupType(event.target.value)}
                placeholder="actionType"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={followupContent}
                onChange={(event) => setFollowupContent(event.target.value)}
                placeholder="跟进内容"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={appendFollowup}
              className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              保存跟进
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">创建报价单（draft）</h2>
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
                placeholder="packageLevel"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={quoteDesignServiceLevel}
                onChange={(event) => setQuoteDesignServiceLevel(event.target.value)}
                placeholder="designServiceLevel"
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
                placeholder="有效期（ISO 可选）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                value={quoteNote}
                onChange={(event) => setQuoteNote(event.target.value)}
                placeholder="交付备注（可选）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <button
              type="button"
              onClick={createQuote}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              创建报价单
            </button>
            {actionFeedback && <p className="mt-2 text-xs text-emerald-700">{actionFeedback}</p>}
          </section>
        </div>
      </section>
    </main>
  );
}
