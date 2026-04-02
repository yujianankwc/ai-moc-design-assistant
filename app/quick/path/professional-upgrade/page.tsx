"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProfessionalProjectNewHref, buildQuickPathHref, readQuickPathContext } from "@/lib/quick-path-context";
import QuickSuccessCard from "@/components/quick-success-card";

type ServiceTier = "basic" | "advance" | "deep_collab";

export default function QuickProfessionalUpgradePage() {
  const router = useRouter();
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);
  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);

  const [serviceTier, setServiceTier] = useState<ServiceTier>("basic");
  const [budgetRange, setBudgetRange] = useState("2000-5000");
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [priority, setPriority] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submittedIntentId, setSubmittedIntentId] = useState("");
  const [isSubmittingIntent, setIsSubmittingIntent] = useState(false);

  const goProjectNew = () => {
    const nextPath = buildProfessionalProjectNewHref({
      ...context,
      quickJudgement: context.quickJudgement || `${context.idea}：建议进入专业评估补齐结构与风险判断。`
    });
    router.push(nextPath);
  };

  const handleSubmitProfessional = async () => {
    if (!contact.trim()) {
      setFeedback("请填写手机号或微信。");
      return;
    }
    setIsSubmittingIntent(true);
    setFeedback("");
    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: context.projectId?.trim() || undefined,
          sourceType: "pro_upgrade",
          contactPhoneOrWechat: contact.trim(),
          contactPreference: contactHint.trim(),
          preferPriorityContact: priority,
          snapshot: {
            projectTitle: context.idea || "轻量创意项目",
            resultSummary: context.quickJudgement || "",
            designServiceLevel: serviceTier,
            uiContext: {
              budgetRange,
              quickPath: "professional_upgrade",
              direction: context.direction,
              style: context.style,
              scale: context.scale
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as { intentId?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "这条完整方案路径暂时没有记下来，请稍后重试。");
      setSubmittedIntentId(data?.intentId || "");
      setFeedback("这条完整方案路径已经记下来了。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "这条完整方案路径暂时没有记下来，请稍后重试。";
      setFeedback(message);
    } finally {
      setIsSubmittingIntent(false);
    }
  };

  if (submittedIntentId) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <QuickSuccessCard
          mode="compact"
          title="这条方向已经记下，准备继续完善"
          summary="后续你可以继续补充细节，再决定要不要走试做或发布。"
          stageLabel="已提交意向"
          nextSuggestion="继续完善这个方向"
          footerHint="这一步是先把完整方案路径记下来，方便继续沟通和判断。"
          items={[
            { label: "服务等级", value: serviceTier === "basic" ? "基础版" : serviceTier === "advance" ? "推进版" : "深度协作版" },
            { label: "预算范围", value: budgetRange },
            { label: "意向单编号", value: submittedIntentId }
          ]}
          actions={
            <>
              <button
                type="button"
                onClick={goProjectNew}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                继续完善这个方向
              </button>
              <Link
                href={submittedIntentId ? `/intents/${submittedIntentId}` : "/projects"}
                className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
              >
                去我的看看
              </Link>
            </>
          }
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">第 2 步 · 继续完善这个方向</h1>
        <p className="mt-2 text-sm text-slate-700">适合方向已经比较明确，想先把结构、预算和目标补充清楚的人。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">你想完善到什么程度？</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { id: "basic", label: "基础版" },
            { id: "advance", label: "推进版" },
            { id: "deep_collab", label: "深度协作版" }
          ].map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setServiceTier(tier.id as ServiceTier)}
              className={
                serviceTier === tier.id
                  ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-slate-900"
                  : "rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 hover:bg-slate-50"
              }
            >
              {tier.label}
            </button>
          ))}
        </div>
        <input
          value={budgetRange}
          onChange={(event) => setBudgetRange(event.target.value)}
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="预算范围（例如：2000-5000）"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">联系方式</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="手机号或微信（必填）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={contactHint}
            onChange={(event) => setContactHint(event.target.value)}
            placeholder="怎么联系更方便（可选）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={priority} onChange={(event) => setPriority(event.target.checked)} />
          希望优先沟通（可选）
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSubmitProfessional}
            disabled={isSubmittingIntent}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isSubmittingIntent ? "正在记下这一步..." : "继续完善这个方向"}
          </button>
          <Link
            href={buildQuickPathHref("small_batch", context)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            还是先下单试做
          </Link>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}
