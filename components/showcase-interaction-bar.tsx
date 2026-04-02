"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  showcaseKey: string;
  baseLikes: number;
  baseWatchers: number;
  initialPersistedLikes: number;
  initialPersistedWatchers: number;
  initialLiked: boolean;
  initialWatching: boolean;
  quickTryHref: string;
};

export default function ShowcaseInteractionBar({
  showcaseKey,
  baseLikes,
  baseWatchers,
  initialPersistedLikes,
  initialPersistedWatchers,
  initialLiked,
  initialWatching,
  quickTryHref
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [watching, setWatching] = useState(initialWatching);
  const [persistedLikes, setPersistedLikes] = useState(initialPersistedLikes);
  const [persistedWatchers, setPersistedWatchers] = useState(initialPersistedWatchers);

  const toggleInteraction = async (actionType: "like" | "watch", nextActive: boolean) => {
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

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">喜欢这个方向</p>
          <p className="mt-2 text-xl font-black text-slate-900">{baseLikes + persistedLikes} 人</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">想看后续</p>
          <p className="mt-2 text-xl font-black text-slate-900">{baseWatchers + persistedWatchers} 人</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400">平台会看什么</p>
          <p className="mt-2 text-base font-bold text-slate-900">会优先挑大家更想继续看的方向</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void toggleInteraction("like", !liked)}
          className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            liked
              ? "bg-slate-900 text-white shadow-[0_4px_0_0_#0f172a]"
              : "border-2 border-slate-200 bg-white text-slate-700 shadow-[0_4px_0_0_#e2e8f0] hover:border-slate-300"
          }`}
        >
          {liked ? "✓ 收藏这个方向" : "收藏这个方向"}
        </button>
        <button
          type="button"
          onClick={() => void toggleInteraction("watch", !watching)}
          className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
            watching
              ? "bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#d97706]"
              : "border-2 border-amber-200 bg-white text-amber-800 shadow-[0_4px_0_0_#fde68a] hover:bg-amber-50"
          }`}
        >
          {watching ? "✓ 想看后续" : "想看后续"}
        </button>
        <Link
          href={quickTryHref}
          className="inline-flex items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all hover:bg-amber-300 active:translate-y-1 active:shadow-none"
        >
          我也试一个类似方向
        </Link>
      </div>
    </>
  );
}
