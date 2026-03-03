"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildProfessionalProjectNewHref, buildQuickPathHref, readQuickPathContext } from "@/lib/quick-path-context";
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

  const goProjectNew = () => {
    const nextPath = buildProfessionalProjectNewHref({
      ...context,
      quickJudgement: context.quickJudgement || `${context.idea}：建议进入专业评估补齐结构与风险判断。`
    });
    const hasMockSession = document.cookie.includes(`${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}`);
    router.push(hasMockSession ? nextPath : `/login?next=${encodeURIComponent(nextPath)}`);
  };

  return (
    <section className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              setSubmitted(true);
              setFeedback("已提交进入专业评估。");
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            提交进入专业评估
          </button>
          <button
            type="button"
            onClick={() => setFeedback("已预约人工沟通，内测期间会尽快联系你。")}
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
        </div>
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>

      {submitted && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-emerald-900">提交成功</h2>
          <p className="mt-2 text-sm text-emerald-900">你的专业评估需求已记录，下一步可继续补全专业创建页。</p>
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
              onClick={() => setFeedback("已预约人工沟通，内测期间会尽快联系你。")}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              预约人工沟通
            </button>
          </div>
        </section>
      )}
    </section>
  );
}

