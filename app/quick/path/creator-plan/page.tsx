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
  const [launchStage, setLaunchStage] = useState<"editing" | "confirming" | "launched">("editing");
  const [joinedCount, setJoinedCount] = useState(6);
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [priority, setPriority] = useState(false);
  const [showHumanForm, setShowHumanForm] = useState(false);
  const [humanContact, setHumanContact] = useState("");
  const [humanContactHint, setHumanContactHint] = useState("");
  const [humanPriority, setHumanPriority] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const storageKey = useMemo(() => `quick_creator_plan_draft:${context.idea || "default"}`, [context.idea]);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { mode?: CreatorMode; targetPeople?: TargetPeople };
      if (parsed.mode) setMode(parsed.mode);
      if (parsed.targetPeople) setTargetPeople(parsed.targetPeople);
      setSaveHint("已为你恢复上次进度");
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ mode, targetPeople }));
    setSaveHint("已为你保存当前进度");
    const timer = window.setTimeout(() => setSaveHint(""), 2000);
    return () => window.clearTimeout(timer);
  }, [mode, storageKey, targetPeople]);

  const handleLaunchSubmit = () => {
    if (!contact.trim()) {
      setFeedback("请填写手机号或微信，方便后续联系。");
      return;
    }
    setLaunchStage("launched");
    setJoinedCount(mode === "group_buy" ? 8 : 5);
    setFeedback(`已发起${mode === "group_buy" ? "团购" : "众筹"}，可继续分享拉新。`);
  };

  const handleHumanSubmit = () => {
    if (!humanContact.trim()) {
      setFeedback("请填写手机号或微信。");
      return;
    }
    setFeedback("已预约人工沟通，我们会尽快联系你。");
  };

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {["支持 1 套试做", "可做小批量推进", "支持设计优化与资深设计师联动", "可继续升级为专业方案"].map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
              {item}
            </span>
          ))}
        </div>
      </section>

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
        <p className="mt-2 text-xs text-slate-500">先确认发起，发起成功后再继续分享邀请。</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setLaunchStage("confirming")}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            确认发起
          </button>
        </div>
        {saveHint && <p className="mt-2 text-xs text-slate-500">{saveHint}</p>}
      </section>

      {launchStage === "confirming" && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-blue-900">发起前确认</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
              模式：{mode === "group_buy" ? "发起团购" : "发起众筹"}
            </p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">目标：{targetPeople} 人</p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">达标后解锁：{unlockText}</p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="手机号或微信（必填）"
              className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={contactHint}
              onChange={(event) => setContactHint(event.target.value)}
              placeholder="怎么联系更方便（可选）"
              className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-blue-800">
            <input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} />
            希望优先沟通（可选）
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleLaunchSubmit}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              确认发起
            </button>
            <button
              type="button"
              onClick={() => setLaunchStage("editing")}
              className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
            >
              返回修改
            </button>
          </div>
        </section>
      )}

      {launchStage === "launched" && (
        <QuickSuccessCard
          title="发起成功"
          summary={`已发起${mode === "group_buy" ? "团购" : "众筹"}，可继续分享拉新。`}
          eta="建议今天先完成首轮分享，尽快拿到首批反馈。"
          items={[
            { label: "当前已报名", value: `${joinedCount} 人` },
            { label: "距目标还差", value: `${remaining} 人` },
            { label: "目标人数", value: `${targetPeople} 人` },
            { label: "达标解锁", value: unlockText }
          ]}
          actions={
            <>
            <button
              type="button"
              onClick={() => {
                setJoinedCount((prev) => Math.min(targetPeople, prev + 3));
                setFeedback("已继续分享，报名人数更新中。");
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              继续分享
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
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              复制邀请链接
            </button>
            </>
          }
        />
      )}

      {launchStage === "launched" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link href={buildQuickResultHref(context)} className="text-emerald-800 hover:underline">
              返回查看方案
            </Link>
            <button type="button" onClick={() => setShowHumanForm(true)} className="text-emerald-800 hover:underline">
              预约人工沟通
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Link href={buildQuickPathHref("small_batch", context)} className="text-slate-700 hover:underline">
            回到小批量测算
          </Link>
          <Link href={buildQuickPathHref("professional_upgrade", context)} className="text-blue-700 hover:underline">
            继续专业评估
          </Link>
          <button type="button" onClick={() => setShowHumanForm((prev) => !prev)} className="text-emerald-700 hover:underline">
            让我们帮你看一下
          </button>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>

      {showHumanForm && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900">预约人工沟通</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={humanContact}
              onChange={(event) => setHumanContact(event.target.value)}
              placeholder="手机号或微信（必填）"
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={humanContactHint}
              onChange={(event) => setHumanContactHint(event.target.value)}
              placeholder="怎么联系更方便（可选）"
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
            <input
              type="checkbox"
              checked={humanPriority}
              onChange={(event) => setHumanPriority(event.target.checked)}
            />
            希望优先沟通（可选）
          </label>
          <button
            type="button"
            onClick={handleHumanSubmit}
            className="mt-3 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            确认预约
          </button>
        </section>
      )}
    </section>
  );
}

