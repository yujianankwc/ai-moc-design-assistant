"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  initialContent: string;
};

export default function ManualEditSection({ projectId, initialContent }: Props) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`/api/projects/${projectId}/manual-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          manualEditContent: content
        })
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "这版补充内容暂时没有记下来，请稍后重试。");
      }

      setMessage("这版补充内容已经记下来了。");
      setIsError(false);
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "这版补充内容暂时没有记下来，请稍后重试。";
      setMessage(text);
      setIsError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        rows={5}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="可先写：本轮先保留的核心设定、准备先改的两点、下一轮希望验证的风险。"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {isSaving ? "正在记下补充内容..." : "记下这版补充内容"}
        </button>
        {message && (
          <p className={`text-xs ${isError ? "text-rose-600" : "text-emerald-700"}`}>{message}</p>
        )}
      </div>
    </div>
  );
}
