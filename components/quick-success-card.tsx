import type { ReactNode } from "react";

type QuickSuccessCardProps = {
  title: string;
  summary: string;
  eta?: string;
  items: Array<{ label: string; value: string }>;
  actions: ReactNode;
  mode?: "default" | "compact";
  stageLabel?: string;
  nextSuggestion?: string;
  footerHint?: string;
};

export default function QuickSuccessCard({
  title,
  summary,
  eta,
  items,
  actions,
  mode = "default",
  stageLabel,
  nextSuggestion,
  footerHint
}: QuickSuccessCardProps) {
  const compact = mode === "compact";
  const displayItems = compact ? items.slice(0, 3) : items;

  return (
    <section className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 shadow-sm sm:p-8">
      {(stageLabel || nextSuggestion) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {stageLabel ? (
            <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800">
              当前阶段 · {stageLabel}
            </span>
          ) : null}
          {nextSuggestion ? (
            <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800">
              当前建议 · {nextSuggestion}
            </span>
          ) : null}
        </div>
      )}
      <h2 className="text-lg font-bold text-emerald-900">{title}</h2>
      <p className="mt-2 text-sm font-medium text-emerald-900">{summary}</p>
      {eta ? <p className="mt-2 text-xs font-bold text-emerald-800">{eta}</p> : null}
      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        {displayItems.map((item) => (
          <p key={item.label} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm">
            <span className="text-slate-500">{item.label}：</span>{item.value}
          </p>
        ))}
      </div>
      <div className={`mt-5 flex flex-col gap-3 ${compact ? "" : "sm:flex-row"}`}>{actions}</div>
      {footerHint ? <p className="mt-4 text-xs font-medium text-emerald-800">{footerHint}</p> : null}
    </section>
  );
}
