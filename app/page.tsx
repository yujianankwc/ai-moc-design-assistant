import Link from "next/link";

export default function LandingPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">开始创作你的积木创意</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          选一个适合你的方式，把想法变成看得见的积木方案。
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link
            href="/quick/new"
            className="group rounded-xl border-2 border-slate-200 bg-slate-50 p-5 transition hover:border-blue-400 hover:shadow-md"
          >
            <p className="text-base font-semibold text-slate-900 group-hover:text-blue-700">快速试创意</p>
            <p className="mt-1 text-sm text-slate-600">写一句话，1 分钟生成方向判断 + AI 创意预览图</p>
            <p className="mt-3 text-xs font-medium text-blue-600">适合：刚有灵感，想快速验证方向</p>
          </Link>
          <Link
            href="/projects/new"
            className="group rounded-xl border-2 border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-md"
          >
            <p className="text-base font-semibold text-slate-900 group-hover:text-slate-700">专业方案工作台</p>
            <p className="mt-1 text-sm text-slate-600">完整填写项目信息，获取可评审、可打样的深度方案</p>
            <p className="mt-3 text-xs font-medium text-slate-500">适合：方向已明确，需要落地方案</p>
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">怎么用？</h2>
        <ol className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-4">
          <li className="rounded-lg bg-slate-50 px-3 py-2.5">1. 选入口，写创意</li>
          <li className="rounded-lg bg-slate-50 px-3 py-2.5">2. AI 生成方向 + 预览图</li>
          <li className="rounded-lg bg-slate-50 px-3 py-2.5">3. 查看并调整方案</li>
          <li className="rounded-lg bg-slate-50 px-3 py-2.5">4. 导出或提交服务</li>
        </ol>
      </div>
    </section>
  );
}
