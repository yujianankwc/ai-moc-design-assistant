"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProfessionalProjectNewHref, buildQuickPathHref, buildQuickResultHref, readQuickPathContext } from "@/lib/quick-path-context";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/session";

type ServiceTier = "basic" | "advance" | "deep_collab";

export default function QuickProfessionalUpgradePage() {
  const router = useRouter();
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);
  const context = useMemo(() => readQuickPathContext(rawSearch), [rawSearch]);

  const [serviceTier, setServiceTier] = useState<ServiceTier>("basic");
  const [intentType, setIntentType] = useState("摆件");
  const [audience, setAudience] = useState("自玩");
  const [budgetRange, setBudgetRange] = useState("2000-5000");
  const [targetSize, setTargetSize] = useState("中型（约200-600颗）");
  const [hasReferenceImage, setHasReferenceImage] = useState(context.referenceImage ? "有" : "无");
  const [planSampling, setPlanSampling] = useState("计划后续打样");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [contact, setContact] = useState("");
  const [contactHint, setContactHint] = useState("");
  const [priority, setPriority] = useState(false);
  const [saveHint, setSaveHint] = useState("");
  const storageKey = useMemo(() => `quick_professional_upgrade_draft:${context.idea || "default"}`, [context.idea]);

  const goProjectNew = () => {
    const nextPath = buildProfessionalProjectNewHref({
      ...context,
      quickJudgement: context.quickJudgement || `${context.idea}：建议进入专业评估补齐结构与风险判断。`
    });
    const hasMockSession = document.cookie.includes(`${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}`);
    router.push(hasMockSession ? nextPath : `/login?next=${encodeURIComponent(nextPath)}`);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        serviceTier?: ServiceTier;
        intentType?: string;
        audience?: string;
        budgetRange?: string;
        targetSize?: string;
        hasReferenceImage?: string;
        planSampling?: string;
        contact?: string;
        contactHint?: string;
        priority?: boolean;
      };
      if (parsed.serviceTier) setServiceTier(parsed.serviceTier);
      if (parsed.intentType) setIntentType(parsed.intentType);
      if (parsed.audience) setAudience(parsed.audience);
      if (parsed.budgetRange) setBudgetRange(parsed.budgetRange);
      if (parsed.targetSize) setTargetSize(parsed.targetSize);
      if (parsed.hasReferenceImage) setHasReferenceImage(parsed.hasReferenceImage);
      if (parsed.planSampling) setPlanSampling(parsed.planSampling);
      if (parsed.contact) setContact(parsed.contact);
      if (parsed.contactHint) setContactHint(parsed.contactHint);
      if (typeof parsed.priority === "boolean") setPriority(parsed.priority);
      setSaveHint("已为你恢复上次进度");
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        serviceTier,
        intentType,
        audience,
        budgetRange,
        targetSize,
        hasReferenceImage,
        planSampling,
        contact,
        contactHint,
        priority
      })
    );
    setSaveHint("已为你保存当前进度");
    const timer = window.setTimeout(() => setSaveHint(""), 2000);
    return () => window.clearTimeout(timer);
  }, [
    audience,
    budgetRange,
    contact,
    contactHint,
    hasReferenceImage,
    intentType,
    planSampling,
    priority,
    serviceTier,
    storageKey,
    targetSize
  ]);

  const handleSubmitProfessional = () => {
    if (!contact.trim()) {
      setFeedback("请填写手机号或微信，方便进入专业评估后联系你。");
      return;
    }
    setSubmitted(true);
    setFeedback("已进入专业评估队列。");
  };

  const handleBookHuman = () => {
    if (!contact.trim()) {
      setFeedback("请先填写手机号或微信。");
      return;
    }
    setFeedback("已预约人工沟通，内测期间会尽快联系你。");
  };

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {["支持 1 套试做", "可做小批量推进", "高砖为战略合作伙伴", "可继续升级为专业方案"].map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1 text-xs text-slate-700">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-slate-900">升级为专业方案</h1>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">补全结构方向</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">评估打样与落地风险</p>
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">整理可沟通的前期方案</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">补充信息</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">更想做成什么</span>
            <select
              value={intentType}
              onChange={(event) => setIntentType(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option>摆件</option>
              <option>礼品</option>
              <option>小套装</option>
              <option>展示型</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">面向谁</span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option>自玩</option>
              <option>送礼</option>
              <option>景区售卖</option>
              <option>店铺陈列</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">预算范围</span>
            <input
              value={budgetRange}
              onChange={(event) => setBudgetRange(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例如：2000-5000"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">目标尺寸或体量</span>
            <input
              value={targetSize}
              onChange={(event) => setTargetSize(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例如：中型（约200-600颗）"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">是否有参考图</span>
            <select
              value={hasReferenceImage}
              onChange={(event) => setHasReferenceImage(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option>有</option>
              <option>无</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">是否计划后续打样 / 小批量</span>
            <select
              value={planSampling}
              onChange={(event) => setPlanSampling(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option>计划后续打样</option>
              <option>计划小批量</option>
              <option>暂不计划</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">服务等级</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { id: "basic", title: "专业基础版", hint: "先补齐关键方向" },
            { id: "advance", title: "专业推进版", hint: "补齐结构 + 风险判断" },
            { id: "deep_collab", title: "深度设计协作版", hint: "适合要推进商业化的项目" }
          ].map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setServiceTier(tier.id as ServiceTier)}
              className={
                serviceTier === tier.id
                  ? "rounded-lg border border-blue-300 bg-blue-50 p-3 text-left"
                  : "rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
              }
            >
              <p className="text-sm font-medium text-slate-900">{tier.title}</p>
              <p className="mt-1 text-xs text-slate-500">{tier.hint}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">交付内容</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {["决策摘要", "创意画像", "相似参考", "风险提示", "前期零件方向建议", "推荐推进路径"].map((item) => (
            <span key={item} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
              {item}
            </span>
          ))}
        </div>
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSubmitProfessional}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            提交进入专业评估
          </button>
          <button
            type="button"
            onClick={handleBookHuman}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            预约人工沟通
          </button>
          <Link
            href={buildQuickPathHref("creator_plan", context)}
            className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
          >
            去团购 / 众筹页
          </Link>
          <button
            type="button"
            onClick={handleBookHuman}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
          >
            让我们帮你看一下
          </button>
        </div>
        {saveHint && <p className="mt-2 text-xs text-slate-500">{saveHint}</p>}
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>

      {submitted && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900">提交成功</h2>
          <p className="mt-2 text-sm text-emerald-900">已进入专业评估队列。</p>
          <p className="mt-1 text-sm text-emerald-900">我们会基于你补充的信息继续推进。</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={goProjectNew}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              去填写专业创建页
            </button>
            <button
              type="button"
              onClick={handleBookHuman}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              预约人工沟通
            </button>
            <Link
              href={buildQuickResultHref(context)}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              返回项目页
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}

