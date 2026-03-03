"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildQuickPathHref, readQuickPathContext } from "@/lib/quick-path-context";

type CreatorMode = "group_buy" | "crowdfunding";
type TargetPeople = 10 | 30 | 50 | 100;

const targetOptions: TargetPeople[] = [10, 30, 50, 100];

export default function QuickCreatorPlanPage() {
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);
  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);
  const modeFromQuery = useMemo(() => {
    const value = new URLSearchParams(rawSearch).get("mode");
    return value === "crowdfunding" ? "crowdfunding" : "group_buy";
  }, [rawSearch]);

  const [mode, setMode] = useState<CreatorMode>("group_buy");
  const [targetPeople, setTargetPeople] = useState<TargetPeople>(30);
  const [launched, setLaunched] = useState(false);
  const [joinedCount, setJoinedCount] = useState(6);
  const [feedback, setFeedback] = useState("");

  const remaining = Math.max(0, targetPeople - joinedCount);

  const unlockText = useMemo(() => {
    if (targetPeople >= 100) return "申请更优单价或更高包装方案";
    if (targetPeople >= 50) return "升级标准礼盒";
    if (targetPeople >= 30) return "免基础设计费";
    return "减免部分设计费";
  }, [targetPeople]);

  useEffect(() => {
    setMode(modeFromQuery);
  }, [modeFromQuery]);

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">原创计划 / 众筹推进</h1>
        <p className="mt-2 text-sm text-slate-700">{context.idea || "当前创意"}：先拉到第一批愿意支持的人，再继续放大投入。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">模式选择</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("group_buy")}
            className={
              mode === "group_buy"
                ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
                : "rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            }
          >
            <p className="text-sm font-medium text-slate-900">发起团购</p>
            <p className="mt-1 text-xs text-slate-500">已经有方向，想凑人数降成本</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("crowdfunding")}
            className={
              mode === "crowdfunding"
                ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
                : "rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
            }
          >
            <p className="text-sm font-medium text-slate-900">发起众筹</p>
            <p className="mt-1 text-xs text-slate-500">先验证市场，看看有多少人愿意支持</p>
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">目标人数</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {targetOptions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTargetPeople(value)}
              className={
                targetPeople === value
                  ? "rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-800"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              }
            >
              {value} 人
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">达标奖励</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">10 人：减免部分设计费</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">30 人：免基础设计费</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">50 人：升级标准礼盒</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">100 人：申请更优单价 / 更高包装方案</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">分享邀请</h2>
        <p className="mt-2 text-xs text-slate-500">邀请成功越多，越容易获得设计费抵扣或包装升级。</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setFeedback("分享卡片已生成（内测占位）。")}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            生成分享卡片
          </button>
          <button
            type="button"
            onClick={async () => {
              const inviteLink = `${window.location.origin}/quick/path/creator-plan?invite=${Date.now()}`;
              try {
                await navigator.clipboard.writeText(inviteLink);
                setFeedback("邀请链接已复制。");
              } catch {
                setFeedback(`请手动复制：${inviteLink}`);
              }
            }}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            复制邀请链接
          </button>
          <button
            type="button"
            onClick={() => {
              setLaunched(true);
              setJoinedCount(mode === "group_buy" ? 8 : 5);
              setFeedback(`已发起${mode === "group_buy" ? "团购" : "众筹"}，可继续分享拉新。`);
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            确认发起
          </button>
        </div>
      </section>

      {launched && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900">发起成功</h2>
          <p className="mt-2 text-sm text-emerald-900">当前已报名：{joinedCount} 人</p>
          <p className="mt-1 text-sm text-emerald-900">距目标还差：{remaining} 人</p>
          <p className="mt-1 text-sm text-emerald-900">达标后解锁：{unlockText}</p>
          <button
            type="button"
            onClick={() => {
              setJoinedCount((prev) => Math.min(targetPeople, prev + 3));
              setFeedback("已继续分享，报名人数更新中。");
            }}
            className="mt-3 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            继续分享
          </button>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={buildQuickPathHref("small_batch", context)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            回到小批量测算
          </Link>
          <Link
            href={buildQuickPathHref("professional_upgrade", context)}
            className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            继续专业评估
          </Link>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}

