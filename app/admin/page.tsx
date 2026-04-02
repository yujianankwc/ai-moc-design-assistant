import Link from "next/link";

const adminEntries = [
  {
    href: "/admin/projects",
    title: "项目总览中台",
    description: "从项目视角看当前阶段、推进路径、公开展示状态和最近建议。"
  },
  {
    href: "/admin/intents",
    title: "推进意向中台",
    description: "集中处理推进意向、最近跟进、报价说明和状态流转。"
  },
  {
    href: "/admin/showcase",
    title: "公开展示运营中台",
    description: "集中控制已经进入公开展示路径的真实项目，处理精选、首页优先和暂停展示。"
  },
  {
    href: "/admin/service-requests",
    title: "服务申请中台",
    description: "集中处理零件补充、试做路径和原创计划申请，记录回复和后续转化状态。"
  }
];

export default function AdminHomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">管理后台</h1>
        <p className="mt-2 text-sm text-slate-600">
          这里是测试期的内部中台入口。当前仍然沿用现有安全方式：先用邀请码登录，再在对应中台页填入
          <span className="font-semibold text-slate-900"> ADMIN_API_TOKEN </span>
          才能读取和操作管理数据。
        </p>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          当前使用方式：
          <br />
          1. 先从前台登录
          <br />
          2. 再进入下面任一中台页面
          <br />
          3. 在页面顶部填入管理口令
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {adminEntries.map((item) => (
          <article key={item.href} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            <Link href={item.href} className="mt-4 inline-flex text-sm font-bold text-blue-700 hover:text-blue-900">
              进入这个中台
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
