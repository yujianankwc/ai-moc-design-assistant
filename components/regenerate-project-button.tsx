"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerationMode } from "@/types/generation-mode";
import {
  clearDiffDismissed,
  modeToLabel,
  saveCurrentModeLabel,
  savePreviousSnapshot,
  type ResultDiffSnapshot
} from "@/lib/result-diff";

type Props = {
  projectId: string;
  currentSnapshot: ResultDiffSnapshot;
};

export default function RegenerateProjectButton({ projectId, currentSnapshot }: Props) {
  const router = useRouter();
  const [loadingMode, setLoadingMode] = useState<GenerationMode | "default" | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const modeLabelMap: Record<GenerationMode, string> = {
    display_focused: "偏展示版",
    cost_focused: "偏成本版",
    production_focused: "偏量产版"
  };

  const successMessageMap: Record<GenerationMode, string> = {
    display_focused: "已生成偏展示方案",
    cost_focused: "已生成偏成本方案",
    production_focused: "已生成偏量产方案"
  };

  const handleRegenerate = async (mode?: GenerationMode) => {
    setLoadingMode(mode ?? "default");
    setMessage("");
    setIsError(false);
    savePreviousSnapshot(projectId, currentSnapshot);

    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(mode ? { mode } : {})
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; warning?: string; usedFallbackOutput?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "重新生成失败，请稍后重试。");
      }

      const successText = mode ? successMessageMap[mode] : "已重新生成最新方案。";
      setMessage(successText);
      setIsError(false);
      saveCurrentModeLabel(projectId, modeToLabel(mode ?? "default"));
      clearDiffDismissed(projectId);

      setTimeout(() => {
        router.refresh();
      }, 600);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "重新生成失败，请稍后重试。";
      setMessage(errorText);
      setIsError(true);
    } finally {
      setLoadingMode(null);
    }
  };

  const isLoading = loadingMode !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleRegenerate()}
          disabled={isLoading}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loadingMode === "default" ? "生成中..." : "重新生成项目方案"}
        </button>
        {(Object.keys(modeLabelMap) as GenerationMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => handleRegenerate(mode)}
            disabled={isLoading}
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loadingMode === mode ? "生成中..." : modeLabelMap[mode]}
          </button>
        ))}
      </div>
      {message && (
        <p className={`text-xs ${isError ? "text-rose-600" : "text-emerald-700"}`}>{message}</p>
      )}
    </div>
  );
}
