"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildQuickPathHref, buildQuickResultHref, readQuickPathContext } from "@/lib/quick-path-context";
import QuickSuccessCard from "@/components/quick-success-card";
import { inferJudgementFromQuickInput } from "@/lib/project-language";
import {
  computeBatchQuote,
  formatCnyRange,
  type BatchQuantity,
  type DesignServiceLevel,
  type PackagingLevel
} from "@/lib/quick-path-pricing";

type UsageGoal = "self_check" | "gift" | "market_test" | "presale";

const usageOptions: Array<{
  value: UsageGoal;
  label: string;
  description: string;
  quantity: BatchQuantity;
  packaging: PackagingLevel;
  designService: DesignServiceLevel;
  recommendation: string;
}> = [
  {
    value: "self_check",
    label: "自己收藏验证",
    description: "先验证值不值得做，不急着上完整包装。",
    quantity: 10,
    packaging: "basic",
    designService: "direct_sample",
    recommendation: "更适合先验证用户兴趣，推荐先做 1-10 套。"
  },
  {
    value: "gift",
    label: "小范围送礼",
    description: "礼品感和稳定性都要兼顾。",
    quantity: 50,
    packaging: "standard_gift",
    designService: "design_optimize",
    recommendation: "更适合礼物方向，推荐 10-50 套做一批能送人的礼盒。"
  },
  {
    value: "market_test",
    label: "测试用户反应",
    description: "适合做第一轮市场试水。",
    quantity: 50,
    packaging: "standard_gift",
    designService: "design_optimize",
    recommendation: "更适合先做小批量验证，推荐 50-100 套看第一波反馈。"
  },
  {
    value: "presale",
    label: "准备预售首发",
    description: "要更完整地考虑商品感和展示感。",
    quantity: 100,
    packaging: "premium_gift",
    designService: "senior_collab",
    recommendation: "更适合作为文创单品尝试，推荐 100 套以上先把商品感做出来。"
  }
];

const coreQuantityOptions: Array<{ value: BatchQuantity; label: string }> = [
  { value: 1, label: "1 套" },
  { value: 10, label: "10 套" },
  { value: 50, label: "50 套" },
  { value: 100, label: "100 套" }
];

const advancedQuantityOptions: Array<{ value: BatchQuantity; label: string }> = [
  { value: 200, label: "200 套" },
  { value: 500, label: "500 套" },
  { value: 1000, label: "1000 套" },
  { value: 3000, label: "3000 套" }
];

const packagingOptions: Array<{ value: PackagingLevel; label: string; description: string }> = [
  { value: "basic", label: "基础包装", description: "先看方案，不做复杂装饰。" },
  { value: "standard_gift", label: "标准礼盒", description: "兼顾商品感和成本。" },
  { value: "premium_gift", label: "升级礼盒", description: "展示更强，适合活动首发。" }
];

const designOptions: Array<{ value: DesignServiceLevel; label: string; description: string }> = [
  { value: "direct_sample", label: "直接打样", description: "优先做一版实物，先看值不值得继续。" },
  { value: "design_optimize", label: "设计优化", description: "补细节和可生产性，更适合继续推进。" },
  { value: "senior_collab", label: "资深设计师联动", description: "适合要做商业化首发的项目。" }
];

export default function QuickSmallBatchPage() {
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);

  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);
  const [usageGoal, setUsageGoal] = useState<UsageGoal>("market_test");
  const [quantity, setQuantity] = useState<BatchQuantity>(50);
  const [packaging, setPackaging] = useState<PackagingLevel>("standard_gift");
  const [designService, setDesignService] = useState<DesignServiceLevel>("design_optimize");
  const [showAdvancedQuantity, setShowAdvancedQuantity] = useState(false);
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [preferPriority, setPreferPriority] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submittedIntentId, setSubmittedIntentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedUsage = useMemo(
    () => usageOptions.find((item) => item.value === usageGoal) ?? usageOptions[2],
    [usageGoal]
  );

  useEffect(() => {
    setQuantity(selectedUsage.quantity);
    setPackaging(selectedUsage.packaging);
    setDesignService(selectedUsage.designService);
  }, [selectedUsage]);

  const quote = useMemo(
    () => computeBatchQuote({ quantity, packaging, designService }),
    [quantity, packaging, designService]
  );
  const pathJudgement = useMemo(
    () =>
      inferJudgementFromQuickInput({
        idea: context.idea || "",
        direction: context.direction || "",
        style: context.style || "",
        scale: context.scale || "",
        referenceImage: context.referenceImage || ""
      }),
    [context.direction, context.idea, context.referenceImage, context.scale, context.style]
  );

  const handleSubmitIntent = async () => {
    if (!contact.trim()) {
      setFeedback("请先留下手机号或微信。");
      return;
    }

    setIsSubmitting(true);
    setFeedback("");
    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: context.projectId?.trim() || undefined,
          sourceType: "small_batch",
          contactPhoneOrWechat: contact.trim(),
          contactPreference: contactHint.trim(),
          preferPriorityContact: preferPriority,
          snapshot: {
            projectTitle: context.idea || "轻量创意项目",
            resultSummary: context.quickJudgement || "",
            selectedQuantity: quantity,
            packageLevel: packaging,
            designServiceLevel: designService,
            estimatedUnitPriceMin: quote.unitPriceRange.min,
            estimatedUnitPriceMax: quote.unitPriceRange.max,
            estimatedTotalPriceMin: quote.totalPriceRange.min,
            estimatedTotalPriceMax: quote.totalPriceRange.max,
            discountAmount: quote.discountAmount,
            pricingMeta: {
              designFee: quote.designFee,
              usageGoal
            },
            uiContext: {
              direction: context.direction,
              style: context.style,
              scale: context.scale
            }
          }
        })
      });
      const data = (await response.json().catch(() => null)) as { intentId?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "这条推进意向暂时没有记下来，请稍后重试。");
      setSubmittedIntentId(data?.intentId || "");
      setSubmitted(true);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "这条推进意向暂时没有记下来，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl">
        <QuickSuccessCard
          mode="compact"
          title="这次试做已经帮你记下了"
          summary="现在你可以继续看这条方向的下一步，也可以稍后再回来继续推进。"
          stageLabel="已提交意向"
          nextSuggestion="继续看这次试做"
          eta="预计 24 小时内会有人继续跟进这条路径。"
          footerHint="这一步只是先记下试做方向，不等于最终打样或量产结论。"
          items={[
            { label: "用途", value: selectedUsage.label },
            { label: "当前配置", value: `${quantity} 套 / ${packagingOptions.find((item) => item.value === packaging)?.label || "-"}` },
            { label: "预估总价", value: formatCnyRange(quote.totalPriceRange) }
          ]}
          actions={
            <>
              <Link
                href={submittedIntentId ? `/intents/${submittedIntentId}` : "/projects"}
                className="relative inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-2.5 font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
              >
                去我的看看
              </Link>
              <Link
                href={buildQuickResultHref(context)}
                className="relative inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
              >
                回到刚才结果
              </Link>
            </>
          }
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border-2 border-amber-100 bg-gradient-to-b from-amber-50/60 to-white p-6 shadow-[0_12px_30px_-18px_rgba(217,119,6,0.35)] sm:p-8">
        <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
          第 2 步 · 先下单试做
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">这次你想先怎么试做？</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {pathJudgement}。这一步适合先做一版，看看这个方向做出来是不是成立。
        </p>
        {context.idea ? <p className="mt-3 text-xs font-medium text-slate-500">当前创意：{context.idea}</p> : null}
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">你想拿这版去做什么？</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {usageOptions.map((option) => {
            const active = usageGoal === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setUsageGoal(option.value)}
                className={`rounded-2xl border-2 p-5 text-left transition-all ${
                  active
                    ? "border-amber-300 bg-amber-50 shadow-[0_4px_0_0_#fde68a]"
                    : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                }`}
              >
                <p className="text-base font-bold text-slate-900">{option.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-blue-100 bg-blue-50/50 p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">系统先给你一版推荐</h2>
        <p className="mt-2 text-sm text-slate-600">当前判断：{pathJudgement}。{selectedUsage.recommendation}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">推荐数量</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{quantity} 套</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">推荐包装</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{packagingOptions.find((item) => item.value === packaging)?.label}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">推荐服务</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{designOptions.find((item) => item.value === designService)?.label}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">如果你想，也可以自己改一下</h2>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-800">数量</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {coreQuantityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQuantity(option.value)}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                    quantity === option.value
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAdvancedQuantity((prev) => !prev)}
                className="rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              >
                {showAdvancedQuantity ? "收起更多数量" : "更多数量（可选）"}
              </button>
            </div>
            {showAdvancedQuantity ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {advancedQuantityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setQuantity(option.value)}
                    className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                      quantity === option.value
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800">包装</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {packagingOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPackaging(option.value)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    packaging === option.value
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{option.label}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800">设计服务</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {designOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDesignService(option.value)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all ${
                    designService === option.value
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40"
                  }`}
                >
                  <p className="text-sm font-bold text-slate-900">{option.label}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
        <h2 className="text-lg font-bold text-slate-900">大概多少钱</h2>
            <p className="mt-2 text-sm text-slate-600">先看一个大概区间，再决定要不要继续。</p>
          </div>
          <button
            type="button"
            onClick={() => setShowQuoteDetails((prev) => !prev)}
            className="text-sm font-medium text-slate-600 hover:text-amber-700 hover:underline"
          >
            {showQuoteDetails ? "收起明细" : "查看明细"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-400">预计总价区间</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCnyRange(quote.totalPriceRange)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-400">当前建议</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{quote.recommendation}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm leading-7 text-slate-600">
          <p className="font-bold text-slate-800">现在最适合：先做一版试做</p>
          <p>这还不是最终定价和定稿，只是帮你先判断值不值得继续。</p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm leading-7 text-slate-600">
          <p className="font-bold text-slate-800">为什么是这个报价区间？</p>
          <p>颗粒数量和结构复杂度会影响成本。</p>
          <p>包装等级会影响整体展示感和单套价格。</p>
          <p>设计服务越深，前期投入越高，但更适合继续推进。</p>
        </div>

        {showQuoteDetails ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              预计单套：<span className="font-bold">{formatCnyRange(quote.unitPriceRange)}</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              当前设计费：<span className="font-bold">¥{quote.designFee}</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              当前减免：<span className="font-bold">¥{quote.discountAmount}</span>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              基础处理费：<span className="font-bold">¥199</span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">把这次试做先记下来</h2>
        <p className="mt-2 text-sm text-slate-600">记下来之后，你可以在“我的”里继续看这条方向。</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            value={contact}
            onChange={(event) => {
              setContact(event.target.value);
              if (feedback) setFeedback("");
            }}
            placeholder="手机号或微信（必填）"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
          />
          <input
            value={contactHint}
            onChange={(event) => setContactHint(event.target.value)}
            placeholder="怎么联系更方便（可选）"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
          />
        </div>
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={preferPriority}
            onChange={(event) => setPreferPriority(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
          />
          希望优先沟通（可选）
        </label>
        {feedback ? <p className="mt-4 text-sm font-medium text-rose-600">{feedback}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmitIntent}
            disabled={isSubmitting}
            className="relative inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? "提交中..." : "先下单试做"}
          </button>
          <Link
            href="/projects"
            className="relative inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
          >
            先记下来，稍后再看
          </Link>
          <Link href="/projects" className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline">
            去我的页面
          </Link>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link href={buildQuickPathHref("professional_upgrade", context)} className="font-medium text-slate-500 hover:text-slate-800 hover:underline">
          继续完善这个方向
        </Link>
        <Link href={buildQuickResultHref(context)} className="font-medium text-slate-500 hover:text-slate-800 hover:underline">
          回到刚才结果
        </Link>
      </div>
    </section>
  );
}
