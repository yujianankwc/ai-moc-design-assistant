"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TOKEN_KEY = "moc_admin_api_token_v1";

type ShowcaseControl = {
  featured: boolean;
  homepage: boolean;
  paused: boolean;
};

type AdminShowcaseControlProps = {
  intentId: string;
  control: ShowcaseControl;
};

type ControlKey = keyof ShowcaseControl;

export default function AdminShowcaseControl({ intentId, control }: AdminShowcaseControlProps) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<ControlKey | "">("");
  const [feedback, setFeedback] = useState("");

  async function toggleControl(key: ControlKey) {
    const adminToken = window.localStorage.getItem(TOKEN_KEY)?.trim() || "";
    if (!adminToken) {
      setFeedback("请先在推进意向中台记下管理端口令。");
      return;
    }

    setLoadingKey(key);
    setFeedback("");

    try {
      const response = await fetch(`/api/admin/intents/${intentId}/showcase-control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken
        },
        body: JSON.stringify({ [key]: !control[key] })
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string; summary?: string };
      if (!response.ok) {
        throw new Error(data.error || "公开展示控制暂时没有更新成功。");
      }

      setFeedback(data.summary ? `已更新：${data.summary}` : "公开展示控制已经更新。");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "公开展示控制暂时没有更新成功。");
    } finally {
      setLoadingKey("");
    }
  }

  const items: Array<{ key: ControlKey; label: string; activeText: string; idleText: string }> = [
    { key: "featured", label: "精选展示", activeText: "取消精选展示", idleText: "设为精选展示" },
    { key: "homepage", label: "首页优先", activeText: "取消首页优先", idleText: "设为首页优先" },
    { key: "paused", label: "暂停公开展示", activeText: "恢复公开展示", idleText: "暂停公开展示" }
  ];

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <p className="text-xs font-medium text-violet-700">公开展示运营控制</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => {
          const active = control[item.key];
          const pending = loadingKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleControl(item.key)}
              disabled={Boolean(loadingKey)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? "border border-violet-300 bg-white text-violet-800"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
              } ${loadingKey ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {pending ? "正在更新..." : active ? item.activeText : item.idleText}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        这组控制只影响公开展示中的曝光方式，不会改变项目本身的推进记录。
      </p>
      {feedback ? <p className="mt-2 text-xs text-violet-700">{feedback}</p> : null}
    </div>
  );
}
