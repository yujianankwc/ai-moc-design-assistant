import Link from "next/link";

export default function LandingPage() {
  return (
    <section className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <p className="text-sm font-medium text-blue-600">内测体验版</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">提交创意项目</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          帮助积木创作者把模糊创意更快整理成可评审、可打样、可落地的项目方案。
        </p>
        <p className="mt-2 max-w-2xl text-xs text-slate-500">
          输入一个想法，系统会帮你完成前期判断、参考整理和下一步推进建议。
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            进入内测并提交创意
          </Link>
          <Link
            href="/projects"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            查看项目列表
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">核心流程</h2>
        <ol className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-5">
          <li className="rounded-lg bg-slate-50 p-3">1. 创建项目</li>
          <li className="rounded-lg bg-slate-50 p-3">2. AI 生成结果</li>
          <li className="rounded-lg bg-slate-50 p-3">3. 编辑结果</li>
          <li className="rounded-lg bg-slate-50 p-3">4. 导出项目简报</li>
          <li className="rounded-lg bg-slate-50 p-3">5. 提交服务申请</li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">你将体验到</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>首页、登录、项目列表、创建项目、项目结果页</li>
            <li>静态流程验证与页面结构完善</li>
            <li>后续再接入真实数据能力</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-base font-semibold text-slate-900">当前暂不包含</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>社区、商城、评论、投票</li>
            <li>创作者主页、支付系统</li>
            <li>复杂权限与平台化功能</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
