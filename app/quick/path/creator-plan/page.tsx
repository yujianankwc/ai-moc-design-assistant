"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buildQuickResultHref, readQuickPathContext } from "@/lib/quick-path-context";
import QuickSuccessCard from "@/components/quick-success-card";

type TargetPeople = 10 | 30 | 50 | 100;

const targetOptions: TargetPeople[] = [10, 30, 50, 100];

function buildAutoPublishStorageKey(token: string) {
  return `quick_creator_plan_autostart:${token}`;
}

export default function QuickCreatorPlanPage() {
  const pathname = usePathname();
  const [rawSearch, setRawSearch] = useState("");
  const [submittedIntentId, setSubmittedIntentId] = useState("");
  const [savedAsPrivateDraft, setSavedAsPrivateDraft] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingSupplement, setIsSavingSupplement] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [priority, setPriority] = useState(false);
  const [targetPeople, setTargetPeople] = useState<TargetPeople>(30);
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);

  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);
  const searchParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);
  const shouldAutoLaunch = searchParams.get("autostart") === "1";
  const launchToken = searchParams.get("launchToken")?.trim() || context.projectId || context.idea || "default";

  const unlockText = useMemo(() => {
    if (targetPeople >= 100) return "更容易进入量产优先观察";
    if (targetPeople >= 50) return "更适合继续推动样品和包装";
    if (targetPeople >= 30) return "更容易判断大家是否愿意继续支持";
    return "先试试看会不会有人愿意支持";
  }, [targetPeople]);

  const clearAutostartQuery = () => {
    if (typeof window === "undefined") return;
    const nextSearch = new URLSearchParams(window.location.search);
    nextSearch.delete("autostart");
    nextSearch.delete("launchToken");
    const nextUrl = nextSearch.toString() ? `${pathname}?${nextSearch.toString()}` : pathname;
    window.history.replaceState({}, "", nextUrl);
  };

  const handleLaunchSubmit = async (input?: {
    contactPhoneOrWechat?: string;
    contactPreference?: string;
    preferPriorityContact?: boolean;
    crowdfundingTargetPeople?: number;
  }) => {
    setIsLaunching(true);
    setFeedback("");
    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: context.projectId?.trim() || undefined,
          sourceType: "crowdfunding",
          contactPhoneOrWechat: input?.contactPhoneOrWechat?.trim() || "",
          contactPreference: input?.contactPreference?.trim() || "",
          preferPriorityContact: Boolean(input?.preferPriorityContact),
          snapshot: {
            projectTitle: context.idea || "轻量创意项目",
            resultSummary: context.quickJudgement || "",
            saleMode: "public_launch",
            crowdfundingTargetPeople: input?.crowdfundingTargetPeople ?? targetPeople,
            intentKind: "quick_publish",
            uiContext: {
              quickPath: "creator_plan",
              direction: context.direction,
              style: context.style,
              scale: context.scale,
              publishedFrom: "quick_result"
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as
        | {
            intentId?: string;
            error?: string;
            privateDraft?: boolean;
            message?: string;
          }
        | null;
      if (!response.ok) throw new Error(data?.error || "这条公开内容暂时没有发出来，请稍后重试。");
      setSubmittedIntentId(data?.intentId || "");
      setSavedAsPrivateDraft(Boolean(data?.privateDraft));
      setFeedback(data?.message || "这条方向已经发出来了。");
      clearAutostartQuery();
    } catch (error) {
      const message = error instanceof Error ? error.message : "这条公开内容暂时没有发出来，请稍后重试。";
      setFeedback(message);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSupplementSave = async () => {
    if (!submittedIntentId) return;
    setIsSavingSupplement(true);
    setFeedback("");
    try {
      const response = await fetch(`/api/intents/${submittedIntentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactPhoneOrWechat: contact,
          contactPreference: contactHint,
          preferPriorityContact: priority,
          snapshot: {
            intentKind: "quick_publish",
            saleMode: "public_launch",
            crowdfundingTargetPeople: targetPeople,
            uiContext: {
              quickPath: "creator_plan",
              publishedFrom: "quick_result"
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "补充信息暂时没有保存成功，请稍后重试。");
      setFeedback("补充信息已经保存好了。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "补充信息暂时没有保存成功，请稍后重试。";
      setFeedback(message);
    } finally {
      setIsSavingSupplement(false);
    }
  };

  useEffect(() => {
    if (!shouldAutoLaunch || autoTriggeredRef.current || submittedIntentId || isLaunching) return;
    const storageKey = buildAutoPublishStorageKey(launchToken);
    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
      autoTriggeredRef.current = true;
      clearAutostartQuery();
      return;
    }
    autoTriggeredRef.current = true;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }
    void handleLaunchSubmit();
  }, [isLaunching, launchToken, shouldAutoLaunch, submittedIntentId]);

  if (!submittedIntentId) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
        <section className="rounded-[28px] border-2 border-amber-100 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(217,119,6,0.35)] sm:p-8">
          <p className="inline-flex rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            第 2 步 · 发出来看看
          </p>
          <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">正在帮你把这条方向发出来</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            先把内容发出来，后面再补联系方式和目标人数也来得及。
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            {isLaunching ? "正在发布中，请稍候..." : feedback || "准备开始发布。"}
          </div>
          {!shouldAutoLaunch && (
            <button
              type="button"
              onClick={() => void handleLaunchSubmit()}
              disabled={isLaunching}
              className="primary-cta mt-6 w-full disabled:pointer-events-none disabled:opacity-60"
            >
              {isLaunching ? "正在发布..." : "发布出来看看"}
            </button>
          )}
          <Link
            href={buildQuickResultHref(context)}
            className="mt-4 inline-flex text-sm font-semibold text-slate-500 hover:text-slate-900"
          >
            先回刚才结果
          </Link>
        </section>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <QuickSuccessCard
        mode="compact"
        title={savedAsPrivateDraft ? "这条方向已先保存为私密草稿" : "这条方向已经发出来了"}
        summary={
          savedAsPrivateDraft
            ? "这条内容已先保存为仅自己可见，等你调整方向或补一张更稳妥的图后，再公开也来得及。"
            : "现在先让大家看到它、给它投票，再慢慢决定要不要继续量产。"
        }
        stageLabel={savedAsPrivateDraft ? "仅自己可见" : "公开展示中"}
        nextSuggestion={savedAsPrivateDraft ? "先调整一下，再决定要不要公开" : "先去看看大家会不会支持它"}
        footerHint={
          savedAsPrivateDraft
            ? "这一步先帮你把记录保住了，但还不会进入公开广场。"
            : "这一步是先发出来收集反馈，不用一开始就把资料全部填完。"
        }
        items={[
          { label: "当前目标", value: `${targetPeople} 人` },
          { label: "现在更适合", value: unlockText }
        ]}
        actions={
          <>
            <Link
              href={savedAsPrivateDraft ? buildQuickResultHref(context) : context.projectId ? `/showcase/${context.projectId}` : "/showcase"}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-400"
            >
              {savedAsPrivateDraft ? "回去继续调整" : "去看公开页"}
            </Link>
            <Link
              href={savedAsPrivateDraft ? "/projects" : "/projects?tab=published"}
              className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm text-amber-800 hover:bg-amber-100"
            >
              {savedAsPrivateDraft ? "去我的创意" : "去我的发布"}
            </Link>
          </>
        }
      />

      <section className="rounded-[28px] border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">再补一点信息会更顺</h2>
        <p className="mt-2 text-sm text-slate-600">这些都不是发布门槛，现在补、以后补都可以。</p>
        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="手机号或微信（可选）"
              className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
            />
            <input
              value={contactHint}
              onChange={(event) => setContactHint(event.target.value)}
              placeholder="怎么联系更方便（可选）"
              className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
            />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">你希望先冲到多少人支持？</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {targetOptions.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTargetPeople(value)}
                  className={
                    targetPeople === value
                      ? "rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"
                      : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  }
                >
                  {value} 人
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{unlockText}</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} />
            如果有人来问，我希望优先被联系
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleSupplementSave()}
            disabled={isSavingSupplement}
            className="primary-cta disabled:pointer-events-none disabled:opacity-60"
          >
            {isSavingSupplement ? "正在保存..." : "保存这些补充信息"}
          </button>
          <Link
            href={buildQuickResultHref(context)}
            className="secondary-cta"
          >
            回到刚才结果
          </Link>
        </div>
        {feedback && <p className="mt-3 text-sm font-medium text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}
