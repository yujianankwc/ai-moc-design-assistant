"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildQuickPathHref, buildQuickResultHref, readQuickPathContext } from "@/lib/quick-path-context";
import QuickSuccessCard from "@/components/quick-success-card";
import {
  computeBatchQuote,
  formatCnyRange,
  type BatchQuantity,
  type DesignServiceLevel,
  type PackagingLevel
} from "@/lib/quick-path-pricing";

const coreQuantityOptions: Array<{ value: BatchQuantity; label: string; recommended?: boolean }> = [
  { value: 1, label: "1 套" },
  { value: 10, label: "10 套" },
  { value: 50, label: "50 套", recommended: true },
  { value: 100, label: "100 套" },
  { value: 200, label: "200 套" }
];

const advancedQuantityOptions: Array<{ value: BatchQuantity; label: string }> = [
  { value: 500, label: "500 套" },
  { value: 1000, label: "1000 套" },
  { value: 3000, label: "3000 套" }
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
  const [showAdvancedQuantity, setShowAdvancedQuantity] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitStage, setSubmitStage] = useState<"editing" | "confirming" | "submitted">("editing");
  const [confirmContact, setConfirmContact] = useState("");
  const [confirmContactHint, setConfirmContactHint] = useState("");
  const [confirmPriority, setConfirmPriority] = useState(false);
  const [humanContact, setHumanContact] = useState("");
  const [humanContactHint, setHumanContactHint] = useState("");
  const [humanPriority, setHumanPriority] = useState(false);
  const [showHumanForm, setShowHumanForm] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const storageKey = useMemo(() => `quick_small_batch_draft:${context.idea || "default"}`, [context.idea]);

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
  const isAdvancedQuantitySelected = quantity === 500 || quantity === 1000 || quantity === 3000;
  const highPriceTips = useMemo(() => {
    const tips: string[] = [];
    if (packaging !== "basic") tips.push("改成基础包装，先压低首版成本");
    if (quantity !== 1) tips.push("先做 1 套试样，只验证方向");
    if (isHighDesignTier) tips.push("先选直接打样，后续再做设计优化");
    tips.push("发起团购摊薄设计费与包装成本");
    return tips;
  }, [isHighDesignTier, packaging, quantity]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        quantity?: BatchQuantity;
        packaging?: PackagingLevel;
        designService?: DesignServiceLevel;
      };
      if (parsed.quantity) setQuantity(parsed.quantity);
      if (parsed.packaging) setPackaging(parsed.packaging);
      if (parsed.designService) setDesignService(parsed.designService);
      setSaveHint("已为你恢复上次进度");
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  useEffect(() => {
    const payload = JSON.stringify({ quantity, packaging, designService });
    window.localStorage.setItem(storageKey, payload);
    setSaveHint("已为你保存当前进度");
    const timer = window.setTimeout(() => setSaveHint(""), 2000);
    return () => window.clearTimeout(timer);
  }, [designService, packaging, quantity, storageKey]);

  const handleConfirmSubmit = () => {
    if (!confirmContact.trim()) {
      setFeedback("请填写手机号或微信，方便人工确认联系你。");
      return;
    }
    setSubmitStage("submitted");
    setFeedback("已进入人工确认流程。预计 24 小时内给你初步确认结果。");
  };

  const handleHumanContactSubmit = () => {
    if (!humanContact.trim()) {
      setFeedback("请填写手机号或微信。");
      return;
    }
    setFeedback("已记录人工沟通请求，我们会尽快联系你。");
  };

  const renderQuantityButton = (value: BatchQuantity, label: string, recommended?: boolean) => (
    <button
      key={value}
      type="button"
      onClick={() => setQuantity(value)}
      className={
        quantity === value
          ? "rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-800"
          : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
      }
    >
      {label}
      {recommended ? "（推荐）" : ""}
    </button>
  );

  if (submitStage === "submitted") {
    return (
      <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <QuickSuccessCard
          title="已提交人工确认"
          summary="已进入人工确认流程。"
          eta="预计 24 小时内给你初步确认结果。"
          items={[
            { label: "数量", value: `${quantity} 套` },
            { label: "包装", value: packagingOptions.find((item) => item.value === packaging)?.label || "-" },
            { label: "设计", value: designOptions.find((item) => item.value === designService)?.label || "-" },
            { label: "预估总价", value: formatCnyRange(quote.totalPriceRange) },
            { label: "设计费", value: `¥${quote.designFee}` },
            { label: "已减免", value: `¥${quote.discountAmount}` }
          ]}
          actions={
            <>
            <button
              type="button"
              onClick={() => setSubmitStage("editing")}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              返回查看当前方案
            </button>
            <Link
              href={`${buildQuickPathHref("creator_plan", context)}&mode=group_buy`}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              去发起团购
            </Link>
            <button
              type="button"
              onClick={() => setShowHumanForm(true)}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              预约人工沟通
            </button>
            </>
          }
        />

        {showHumanForm && (
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-emerald-900">预约人工沟通</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={humanContact}
                onChange={(event) => setHumanContact(event.target.value)}
                placeholder="手机号或微信（必填）"
                className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
              />
              <input
                value={humanContactHint}
                onChange={(event) => setHumanContactHint(event.target.value)}
                placeholder="怎么联系更方便（可选）"
                className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
              <input
                type="checkbox"
                checked={humanPriority}
                onChange={(event) => setHumanPriority(event.target.checked)}
              />
              希望优先沟通（可选）
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleHumanContactSubmit}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
              >
                确认预约
              </button>
              <Link
                href={buildQuickResultHref(context)}
                className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
              >
                返回查看方案
              </Link>
            </div>
            {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
          </section>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {["支持 1 套试做", "可做小批量推进", "支持设计优化与资深设计师联动"].map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">小批量试做配置</h1>
        <p className="mt-2 text-sm text-slate-700">{context.idea || "当前创意"}：先做一版实物，看看值不值得继续推。</p>
        <p className="mt-1 text-xs text-slate-500">支持 1 套试做，但单套成本会明显更高。</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">数量选择</h2>
        <p className="mt-1 text-xs text-slate-500">先选一个适合当前阶段的数量。</p>
        <p className="mt-1 text-xs text-slate-500">首次试水建议从 50 套开始，数量越高通常单套越划算。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {coreQuantityOptions.map((option) => renderQuantityButton(option.value, option.label, option.recommended))}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedQuantity((prev) => !prev)}
            className="text-xs text-slate-600 hover:text-slate-800 hover:underline"
          >
            {showAdvancedQuantity || isAdvancedQuantitySelected ? "收起更大数量" : "查看更多数量"}
          </button>
        </div>

        {(showAdvancedQuantity || isAdvancedQuantitySelected) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {advancedQuantityOptions.map((option) => renderQuantityButton(option.value, option.label))}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-600">{quote.recommendation}</p>
        <div className="mt-2 text-xs text-slate-500">
          需要 5000 套以上？
          <button
            type="button"
            onClick={() => setShowHumanForm(true)}
            className="ml-1 text-blue-700 hover:underline"
          >
            联系客服询价
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">包装等级</h2>
        <p className="mt-1 text-xs text-slate-500">默认推荐标准礼盒：兼顾商品感和成本。</p>
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
        <p className="mt-1 text-xs text-slate-500">满 50 套免基础设计费；满 100 套可抵扣部分设计优化费。</p>
        <p className="mt-1 text-xs text-slate-500">默认推荐设计优化：适合把结构和商品表达做得更稳一点。</p>
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
        <p className="mt-2 text-xs text-slate-500">团购 / 众筹达标后可升级包装或进一步减免设计费。</p>
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
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {highPriceTips.map((tip) => (
              <li key={tip}>- {tip}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push(`${buildQuickPathHref("creator_plan", context)}&mode=group_buy`)}
            className="mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            去发起团购
          </button>
        </section>
      )}

      {submitStage === "confirming" && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-blue-900">下单意向确认</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">数量：{quantity} 套</p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
              包装：{packagingOptions.find((item) => item.value === packaging)?.label}
            </p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">
              设计：{designOptions.find((item) => item.value === designService)?.label}
            </p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">预估总价：{formatCnyRange(quote.totalPriceRange)}</p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">设计费：¥{quote.designFee}</p>
            <p className="rounded-md bg-white px-3 py-2 text-sm text-slate-700">已减免：¥{quote.discountAmount}</p>
          </div>
          <p className="mt-3 text-xs text-blue-800">
            这是前期预估价，后续会结合结构复杂度和包装要求做人工确认。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={confirmContact}
              onChange={(event) => setConfirmContact(event.target.value)}
              placeholder="手机号或微信（必填）"
              className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={confirmContactHint}
              onChange={(event) => setConfirmContactHint(event.target.value)}
              placeholder="怎么联系更方便（可选）"
              className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-blue-800">
            <input
              type="checkbox"
              checked={confirmPriority}
              onChange={(event) => setConfirmPriority(event.target.checked)}
            />
            希望优先沟通（可选）
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleConfirmSubmit}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              确认提交
            </button>
            <button
              type="button"
              onClick={() => setSubmitStage("editing")}
              className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
            >
              返回修改
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setSubmitStage("confirming")}
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
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <Link href={buildQuickPathHref("professional_upgrade", context)} className="text-blue-700 hover:underline">
            去专业评估
          </Link>
          <button
            type="button"
            onClick={() => setShowHumanForm((prev) => !prev)}
            className="text-emerald-700 hover:underline"
          >
            让我们帮你看一下
          </button>
        </div>
        {saveHint && <p className="mt-2 text-xs text-slate-500">{saveHint}</p>}
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>

      {showHumanForm && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900">预约人工沟通</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={humanContact}
              onChange={(event) => setHumanContact(event.target.value)}
              placeholder="手机号或微信（必填）"
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={humanContactHint}
              onChange={(event) => setHumanContactHint(event.target.value)}
              placeholder="怎么联系更方便（可选）"
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
            <input
              type="checkbox"
              checked={humanPriority}
              onChange={(event) => setHumanPriority(event.target.checked)}
            />
            希望优先沟通（可选）
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleHumanContactSubmit}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              确认预约
            </button>
            <Link
              href={buildQuickResultHref(context)}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              返回查看方案
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}

