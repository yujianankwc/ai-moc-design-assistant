"use client";

import { useMemo, useState } from "react";
import {
  buildDiffSummary,
  isDiffDismissed,
  readCurrentModeLabel,
  readPreviousSnapshot,
  setDiffDismissed,
  type ResultDiffSnapshot
} from "@/lib/result-diff";

type Props = {
  projectId: string;
  currentSnapshot: ResultDiffSnapshot;
};

export default function ResultDiffSummary({ projectId, currentSnapshot }: Props) {
  const [dismissed, setDismissed] = useState(() => isDiffDismissed(projectId));

  const summaryLines = useMemo(() => {
    const previousSnapshot = readPreviousSnapshot(projectId);
    if (!previousSnapshot) return null;
    const currentModeLabel = readCurrentModeLabel(projectId);
    return buildDiffSummary({
      previous: previousSnapshot,
      current: currentSnapshot,
      currentModeLabel
    });
  }, [projectId, currentSnapshot]);

  if (dismissed || !summaryLines || summaryLines.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-emerald-900">本次生成差异摘要</h2>
          <p className="mt-1 text-xs text-emerald-800">对比对象：上一次方案结果</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDiffDismissed(projectId);
            setDismissed(true);
          }}
          className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
        >
          收起
        </button>
      </div>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-900">
        {summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
