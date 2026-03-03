"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildQuickPathHref, readQuickPathContext } from "@/lib/quick-path-context";
import {
  computeBatchQuote,
  formatCnyRange,
  type BatchQuantity,
  type DesignServiceLevel,
  type PackagingLevel
} from "@/lib/quick-path-pricing";

const quantityOptions: Array<{ value: BatchQuantity; label: string; hint?: string; recommended?: boolean }> = [
  { value: 1, label: "1 套", hint: "可做 / 单价高" },
  { value: 10, label: "10 套" },
  { value: 50, label: "50 套", recommended: true },
  { value: 100, label: "100 套" },
  { value: 200, label: "200 套" }
];

const packagingOptions: Array<{ value: PackagingLevel; label: string; hint: string }> = [
  { value: "basic", label: "基础包装", hint: "先看方案，不做复杂装饰" },
  { value: "standard_gift", label: "标准礼盒", hint: "适合景区礼品或门店陈列" },
  { value: "premium_gift", label: "升级礼盒", hint: "展示感更强，适合活动首发" }
];

const designOptions: Array<{ value: DesignServiceLevel; label: string; hint: string }> = [
  { value: "direct_sample", label: "直接打样", hint: "先快速做一版实物" },
  { value: "design_optimize", label: "设计优化", hint: "补细节和可生产性" },
  { value: "senior_collab", label: "资深设计师联动", hint: "做更完整的商业化打磨" }
];

export default function QuickSmallBatchPage() {
  const router = useRouter();
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);
  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);
  const [quantity, setQuantity] = useState<BatchQuantity>(50);
  const [packaging, setPackaging] = useState<PackagingLevel>("standard_gift");
  const [designService, setDesignService] = useState<DesignServiceLevel>("design_optimize");
  const [feedback, setFeedback] = useState("");

  const quote = useMemo(
    () =>
      computeBatchQuote({
        quantity,
        packaging,
        designService
      }),
    [designService, packaging, quantity]
  );

  const isHighDesignTier = designService === "design_optimize" || designService === "senior_collab";
  const shouldShowHighPriceGuide = (quantity === 1 || quantity === 10) && isHighDesignTier;

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">小批量试做配置</h1>
        <p className="mt-2 text-sm text-slate-700">{context.idea || "当前创意"}：先做一版实物，看看值不值得继续推。</p>
        <p className="mt-1 text-xs text-slate-500">支持 1 套试做，但单套成本会明显更高。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">数量选择</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quantityOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setQuantity(option.value)}
              className={
                quantity === option.value
                  ? "rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-800"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              }
            >
              {option.label}
              {option.recommended ? "（推荐试水）" : ""}
              {option.hint ? ` · ${option.hint}` : ""}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">包装等级</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {packagingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPackaging(option.value)}
              className={
                packaging === option.value
                  ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
                  : "rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              }
            >
              <p className="text-sm font-medium text-slate-900">{option.label}</p>
              <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">设计服务</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {designOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDesignService(option.value)}
              className={
                designService === option.value
                  ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
                  : "rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              }
            >
              <p className="text-sm font-medium text-slate-900">{option.label}</p>
              <p className="mt-1 text-xs text-slate-500">{option.hint}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>满 50 套可免基础设计费；满 100 套可抵扣部分设计优化费。</p>
          <p className="mt-1">团购 / 众筹达标后可升级包装或减免设计费。</p>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-emerald-900">用料说明</h2>
        <p className="mt-2 text-sm text-emerald-900">
          我们优先采用国内高品质高砖颗粒进行打样与小批量方案评估。
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          高砖为战略合作伙伴，可在颗粒稳定性、颜色一致性和供货能力上提供更可靠的前期支持。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">报价结果（预估区间）</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">预计单套：{formatCnyRange(quote.unitPriceRange)}</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">预计总价：{formatCnyRange(quote.totalPriceRange)}</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">当前设计费：¥{quote.designFee}</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">当前已减免：¥{quote.discountAmount}</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">基础处理费：¥199（已计入总价区间）</p>
        <p className="mt-3 text-sm text-slate-700">{quote.recommendation}</p>
      </section>

      {shouldShowHighPriceGuide && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <p className="text-sm text-amber-900">
            如果你觉得现在价格偏高，可以先发起团购，凑够人数后更容易减免设计费并优化包装
          </p>
          <button
            type="button"
            onClick={() => router.push(`${buildQuickPathHref("creator_plan", context)}&mode=group_buy`)}
            className="mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            去发起团购
          </button>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setFeedback("已提交人工确认，我们会尽快联系你。")}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            提交人工确认
          </button>
          <button
            type="button"
            onClick={() => setFeedback("这版报价已保存（内测占位）。")}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            先保存这版报价
          </button>
          <Link
            href={buildQuickPathHref("professional_upgrade", context)}
            className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            去专业评估
          </Link>
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}

