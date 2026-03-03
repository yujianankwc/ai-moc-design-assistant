import type { ReactNode } from "react";

type QuickSuccessCardProps = {
  title: string;
  summary: string;
  eta?: string;
  items: Array<{ label: string; value: string }>;
  actions: ReactNode;
};

export default function QuickSuccessCard({ title, summary, eta, items, actions }: QuickSuccessCardProps) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-emerald-900">{title}</h2>
      <p className="mt-2 text-sm text-emerald-900">{summary}</p>
      {eta ? <p className="mt-1 text-xs text-emerald-800">{eta}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <p key={item.label} className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
            {item.label}：{item.value}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">{actions}</div>
    </section>
  );
}

