"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  showcaseKey: string;
  baseLikes: number;
  baseWatchers: number;
  initialPersistedLikes: number;
  initialPersistedWatchers: number;
  initialLiked: boolean;
  initialWatching: boolean;
  quickTryHref: string;
  autoBuy?: boolean;
  buyIntentPayload?: {
    projectId?: string;
    projectTitle: string;
    resultSummary?: string;
  } | null;
};

export default function ShowcaseInteractionBar({
  showcaseKey,
  baseLikes,
  baseWatchers,
  initialPersistedLikes,
  initialPersistedWatchers,
  initialLiked,
  initialWatching,
  quickTryHref,
  autoBuy = false,
  buyIntentPayload = null
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [liked, setLiked] = useState(initialLiked);
  const [watching, setWatching] = useState(initialWatching);
  const [persistedLikes, setPersistedLikes] = useState(initialPersistedLikes);
  const [persistedWatchers, setPersistedWatchers] = useState(initialPersistedWatchers);
  const [isBuying, setIsBuying] = useState(false);
  const [hasBoughtInterest, setHasBoughtInterest] = useState(false);
  const [feedback, setFeedback] = useState("");
  const autoBuyTriggeredRef = useRef(false);

  const postInteraction = async (actionType: "like" | "watch", nextActive: boolean) => {
    const res = await fetch(`/api/showcase/${showcaseKey}/interaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        actionType,
        active: nextActive
      })
    });
    const data = (await res.json().catch(() => null)) as
      | { likes?: number; watchers?: number; liked?: boolean; watching?: boolean }
      | { error?: string }
      | null;
    if (!res.ok) {
      const errorMessage =
        data && "error" in data && typeof data.error === "string" ? data.error : "公开展示互动更新失败。";
      throw new Error(errorMessage);
    }
    const successData = (data || {}) as {
      likes?: number;
      watchers?: number;
      liked?: boolean;
      watching?: boolean;
    };
    setPersistedLikes(successData.likes ?? persistedLikes);
    setPersistedWatchers(successData.watchers ?? persistedWatchers);
    setLiked(Boolean(successData.liked));
    setWatching(Boolean(successData.watching));
  };

  const chooseVote = async (actionType: "like" | "watch") => {
    setFeedback("");
    if (actionType === "like" && liked) return;
    if (actionType === "watch" && watching) return;
    try {
      if (actionType === "like" && watching) {
        await postInteraction("watch", false);
      }
      if (actionType === "watch" && liked) {
        await postInteraction("like", false);
      }
      await postInteraction(actionType, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "这次投票暂时没有记下来，请稍后重试。";
      setFeedback(message);
    }
  };

  const submitBuyIntent = async () => {
    if (!buyIntentPayload) return;
    setIsBuying(true);
    setFeedback("");
    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          projectId: buyIntentPayload.projectId || undefined,
          sourceType: "crowdfunding",
          contactPhoneOrWechat: "",
          snapshot: {
            projectTitle: buyIntentPayload.projectTitle,
            resultSummary: buyIntentPayload.resultSummary || "",
            intentKind: "purchase_interest",
            saleMode: "mass_production_interest",
            uiContext: {
              from: "showcase_detail",
              showcaseKey
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`${pathname}?autobuy=1`)}`);
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error || "这条想买记录暂时没有记下来，请稍后重试。");
      }
      setHasBoughtInterest(true);
      setFeedback("已经帮你记下想买量产版了，后面可以去「我的」里继续看。");
      router.replace(pathname);
    } catch (error) {
      const message = error instanceof Error ? error.message : "这条想买记录暂时没有记下来，请稍后重试。";
      setFeedback(message);
    } finally {
      setIsBuying(false);
    }
  };

  useEffect(() => {
    if (!autoBuy || !buyIntentPayload || autoBuyTriggeredRef.current) return;
    autoBuyTriggeredRef.current = true;
    void submitBuyIntent();
  }, [autoBuy, buyIntentPayload]);

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">支持量产</p>
          <p className="mt-2 text-xl font-black text-slate-900">{baseLikes + persistedLikes} 人</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">先观望</p>
          <p className="mt-2 text-xl font-black text-slate-900">{baseWatchers + persistedWatchers} 人</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">平台会看什么</p>
          <p className="mt-2 text-base font-bold text-slate-900">会优先看大家更支持量产的方向</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void chooseVote("like")}
          className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            liked
              ? "bg-slate-900 text-white shadow-[0_4px_0_0_#0f172a]"
              : "border-2 border-slate-200 bg-white text-slate-700 shadow-[0_4px_0_0_#e2e8f0] hover:border-slate-300"
          }`}
        >
          {liked ? "✓ 支持量产" : "支持量产"}
        </button>
        <button
          type="button"
          onClick={() => void chooseVote("watch")}
          className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            watching
              ? "bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#d97706]"
              : "border-2 border-amber-200 bg-white text-amber-800 shadow-[0_4px_0_0_#fde68a] hover:bg-amber-50"
          }`}
        >
          {watching ? "✓ 先观望" : "先观望"}
        </button>
        {buyIntentPayload ? (
          <button
            type="button"
            onClick={() => void submitBuyIntent()}
            disabled={isBuying || hasBoughtInterest}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_4px_0_0_#047857] transition-all hover:bg-emerald-400 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60"
          >
            {hasBoughtInterest ? "已记下我想买" : isBuying ? "正在记下..." : "我想买量产版"}
          </button>
        ) : null}
        <Link
          href={quickTryHref}
          className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all hover:bg-amber-300 active:translate-y-1 active:shadow-none"
        >
          我也想试一个
        </Link>
      </div>
      {feedback ? <p className="mt-3 text-sm font-medium text-emerald-700">{feedback}</p> : null}
    </>
  );
}
