"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ServiceRequestRow, ServiceRequestStatus, ServiceRequestType } from "@/types/service-request";

const TOKEN_KEY = "moc_admin_api_token_v1";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function mapRequestTypeLabel(value: ServiceRequestType) {
  if (value === "bom_review") return "零件与结构补充";
  if (value === "sampling_review") return "试做路径申请";
  return "原创计划申请";
}

function mapRequestStatusLabel(value: ServiceRequestStatus) {
  if (value === "pending") return "待处理";
  if (value === "reviewing") return "处理中";
  if (value === "responded") return "已回复";
  if (value === "converted") return "已转后续推进";
  return "已关闭";
}

export default function AdminServiceRequestsPage() {
  const [token, setToken] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusToUpdate, setStatusToUpdate] = useState<ServiceRequestStatus>("reviewing");
  const [operatorNote, setOperatorNote] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setToken(window.localStorage.getItem(TOKEN_KEY) || "");
  }, []);

  const headers = useMemo(() => {
    const base: HeadersInit = { "Content-Type": "application/json" };
    if (token.trim()) base["x-admin-token"] = token.trim();
    return base;
  }, [token]);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (keyword.trim()) params.set("keyword", keyword.trim());
      params.set("limit", "50");
      const res = await fetch(`/api/admin/service-requests?${params.toString()}`, { headers });
      const data = (await res.json().catch(() => null)) as { items?: ServiceRequestRow[]; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "服务申请列表暂时没有读取出来");
      setItems(data?.items || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "服务申请列表暂时没有读取出来");
    } finally {
      setLoading(false);
    }
  }, [headers, keyword, statusFilter]);

  const saveToken = () => {
    window.localStorage.setItem(TOKEN_KEY, token.trim());
    setFeedback("管理端口令已经先记在当前浏览器里。");
  };

  const updateStatus = async () => {
    if (!selectedId) return;
    setFeedback("");
    try {
      const res = await fetch(`/api/admin/service-requests/${selectedId}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          toStatus: statusToUpdate,
          note: operatorNote
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "服务申请状态更新失败");
      setFeedback("服务申请状态已经更新。");
      await loadItems();
    } catch (updateError) {
      setFeedback(updateError instanceof Error ? updateError.message : "服务申请状态更新失败");
    }
  };

  const summary = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      reviewing: items.filter((item) => item.status === "reviewing").length,
      responded: items.filter((item) => item.status === "responded" || item.status === "converted").length
    }),
    [items]
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">服务申请中台</h1>
            <p className="mt-1 text-sm text-slate-600">集中处理零件补充、试做路径和原创计划申请，方便内部回复和转入后续推进。</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin/intents" className="font-medium text-blue-700 hover:underline">
              查看推进意向中台
            </Link>
            <Link href="/admin/projects" className="font-medium text-slate-700 hover:underline">
              查看项目总览中台
            </Link>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="请输入 x-admin-token"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm sm:max-w-xl"
          />
          <button type="button" onClick={saveToken} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            保存 Token
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">当前申请总数</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">待处理 / 处理中</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{summary.pending + summary.reviewing}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">已回复 / 已转推进</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{summary.responded}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">筛选服务申请</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">全部状态</option>
                <option value="pending">待处理</option>
                <option value="reviewing">处理中</option>
                <option value="responded">已回复</option>
                <option value="converted">已转后续推进</option>
                <option value="closed">已关闭</option>
              </select>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="关键词（项目 / 联系方式 / 编号）"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button type="button" onClick={loadItems} className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {loading ? "正在读取..." : "读取服务申请"}
            </button>
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-900">当前申请列表</h2>
            <div className="mt-3 space-y-2">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">这里还没有服务申请记录，可以先读取列表再看看。</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <Link href="/admin/projects" className="font-medium text-slate-700 hover:underline">
                      去项目总览中台看看
                    </Link>
                    <Link href="/service-requests" className="font-medium text-blue-700 hover:underline">
                      看用户侧服务申请页
                    </Link>
                  </div>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setStatusToUpdate(item.status === "pending" ? "reviewing" : item.status);
                      setOperatorNote(item.operator_note || "");
                    }}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      selectedId === item.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-white">
                        {mapRequestStatusLabel(item.status)}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        {mapRequestTypeLabel(item.request_type)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{item.project_title || "未命名项目"}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.contact_info}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">当前服务申请</h2>
          {!selectedItem ? (
            <p className="mt-2 text-sm text-slate-500">先从左侧选一条服务申请，这里会显示申请内容和处理状态。</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-bold text-white">
                    {mapRequestStatusLabel(selectedItem.status)}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
                    {mapRequestTypeLabel(selectedItem.request_type)}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{selectedItem.project_title || "未命名项目"}</p>
                <p className="mt-2 text-sm text-slate-700">联系方式：{selectedItem.contact_info}</p>
                <p className="mt-2 text-sm text-slate-700">{selectedItem.request_note}</p>
                <p className="mt-3 text-xs text-slate-500">提交时间：{formatDate(selectedItem.created_at)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-900">申请补充信息</h3>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
                  {JSON.stringify(selectedItem.metadata || {}, null, 2)}
                </pre>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={statusToUpdate}
                  onChange={(event) => setStatusToUpdate(event.target.value as ServiceRequestStatus)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="pending">待处理</option>
                  <option value="reviewing">处理中</option>
                  <option value="responded">已回复</option>
                  <option value="converted">已转后续推进</option>
                  <option value="closed">已关闭</option>
                </select>
                <button type="button" onClick={updateStatus} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  记下当前状态
                </button>
              </div>
              <textarea
                value={operatorNote}
                onChange={(event) => setOperatorNote(event.target.value)}
                placeholder="补一句处理备注，例如：已回复用户，建议先走试做路径"
                className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {feedback ? <p className="text-xs text-emerald-700">{feedback}</p> : null}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
