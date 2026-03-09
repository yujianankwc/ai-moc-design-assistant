"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildQuickPathHref, buildQuickResultHref, readQuickPathContext } from "@/lib/quick-path-context";
import QuickSuccessCard from "@/components/quick-success-card";

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
  const [submittedIntentId, setSubmittedIntentId] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [priority, setPriority] = useState(false);

  useEffect(() => {
    setMode(modeFromQuery);
  }, [modeFromQuery]);

  const unlockText = useMemo(() => {
    if (targetPeople >= 100) return "更优单价 / 更高包装";
    if (targetPeople >= 50) return "升级标准礼盒";
    if (targetPeople >= 30) return "免基础设计费";
    return "减免部分设计费";
  }, [targetPeople]);

  const handleLaunchSubmit = async () => {
    if (!contact.trim()) {
      setFeedback("请填写手机号或微信。");
      return;
    }
    setIsLaunching(true);
    setFeedback("");
    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "crowdfunding",
          contactPhoneOrWechat: contact.trim(),
          contactPreference: contactHint.trim(),
          preferPriorityContact: priority,
          snapshot: {
            projectTitle: context.idea || "轻量创意项目",
            resultSummary: context.quickJudgement || "",
            saleMode: mode,
            crowdfundingTargetPeople: targetPeople,
            uiContext: {
              quickPath: "creator_plan",
              direction: context.direction,
              style: context.style,
              scale: context.scale
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as { intentId?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "这条公开展示路径暂时没有记下来，请稍后重试。");
      setSubmittedIntentId(data?.intentId || "");
      setFeedback("这条公开展示路径已经记下来了。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "这条公开展示路径暂时没有记下来，请稍后重试。";
      setFeedback(message);
    } finally {
      setIsLaunching(false);
    }
  };

  if (submittedIntentId) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <QuickSuccessCard
          mode="compact"
          title="这条公开展示路径已经记下了"
          summary={mode === "group_buy" ? "现在可以继续分享这条方向，先看看会不会有人愿意一起推进。" : "现在可以继续公开展示这条方向，先看看会不会有人愿意关注后续。"}
          stageLabel="公开展示中"
          nextSuggestion="继续公开展示"
          footerHint="这一步用于先收集关注和反馈，不等于已经进入真实众筹或预售。"
          items={[
            { label: "目标人数", value: `${targetPeople} 人` },
            { label: "达标奖励", value: unlockText },
            { label: "意向单编号", value: submittedIntentId }
          ]}
          actions={
            <>
              <Link
                href={submittedIntentId ? `/intents/${submittedIntentId}` : "/intents"}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                继续看当前阶段
              </Link>
              <Link
                href={buildQuickResultHref(context)}
                className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
              >
                回到方向判断页
              </Link>
            </>
          }
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">团购 / 众筹（备选）</h1>
        <p className="mt-2 text-sm text-slate-700">适合你想先拉一批支持者，再决定是否扩大投入。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">模式与目标</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("group_buy")}
            className={
              mode === "group_buy"
                ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left text-sm text-slate-900"
                : "rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            }
          >
            发起团购
          </button>
          <button
            type="button"
            onClick={() => setMode("crowdfunding")}
            className={
              mode === "crowdfunding"
                ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left text-sm text-slate-900"
                : "rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            }
          >
            发起众筹
          </button>
        </div>
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
        <p className="mt-2 text-xs text-slate-500">当前展示重点：{unlockText}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">联系方式</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="手机号或微信（必填）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={contactHint}
            onChange={(event) => setContactHint(event.target.value)}
            placeholder="怎么联系更方便（可选）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} />
          希望优先沟通（可选）
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleLaunchSubmit}
            disabled={isLaunching}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isLaunching ? "正在记下这一步..." : "记下公开展示路径"}
          </button>
          <Link
            href={buildQuickPathHref("small_batch", context)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            改走试做路径
          </Link>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}
