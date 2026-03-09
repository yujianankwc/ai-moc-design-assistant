import Link from "next/link";
import { getFeaturedShowcaseProjects } from "@/data/showcase-projects";

const featuredProjects = getFeaturedShowcaseProjects(6);

const steps = [
  { title: "写下创意", description: "一句话或一张参考图，先把想法说清楚。" },
  { title: "看方向判断", description: "不只看图，还看这个方向适不适合继续。" },
  { title: "选推进方式", description: "进入试做路径、提交推进意向，或补充完整方案。" },
  { title: "进入项目池", description: "后续可展示、跟进，未来还能继续出道。" }
];

const audiences = [
  { title: "景区 / 文创团队", description: "想先试一款纪念礼品，看题材有没有商品感。" },
  { title: "高校 / 社团", description: "想把校园记忆点先变成可以讨论的积木方向。" },
  { title: "玩家 / 创作者", description: "先验证创意值不值得继续做，再决定要不要深挖。" },
  { title: "品牌 / 内容团队", description: "把题材先变成积木方案，方便沟通和继续推进。" }
];

export default function LandingPage() {
  return (
    <section className="space-y-6">
      <section className="rounded-[32px] border-2 border-amber-100 bg-[radial-gradient(circle_at_top_left,_rgba(253,230,138,0.55),_transparent_35%),linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,1))] p-6 shadow-[0_16px_40px_-24px_rgba(217,119,6,0.35)] sm:p-8">
        <div className="max-w-3xl space-y-3 sm:space-y-4">
          <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
            AI积木创意孵化平台
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-5xl">
            把你的灵感，变成可推进的积木项目
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            先试创意，看到方向；再做试做、提交意向。这里不是只出一张图，而是帮你把创意往下推进。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/quick/new"
              className="relative inline-flex items-center justify-center rounded-2xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-amber-950 shadow-[0_6px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-[0_2px_0_0_#d97706] sm:w-auto"
            >
              先试一个创意
            </Link>
            <Link
              href="/showcase"
              className="relative inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-800 active:translate-y-1 active:shadow-none sm:w-auto"
            >
              看看别人都在做什么
            </Link>
          </div>
          <p className="text-xs font-medium text-slate-500">不是只出一张图，而是帮你把创意往下推进。</p>
        </div>

        <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2">
          <Link
            href="/quick/new"
            className="rounded-3xl border-2 border-amber-200 bg-white/90 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-amber-400 hover:shadow-[0_8px_0_0_#f59e0b]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-bold text-slate-900">快速试创意</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">适合刚有想法</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">一句话试方向，先看图和判断，再决定值不值得继续。</p>
          </Link>
          <Link
            href="/projects/new"
            className="rounded-3xl border-2 border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_8px_0_0_#93c5fd]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-bold text-slate-900">完整方案</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">适合认真推进</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">补齐结构、风险和打样思路，生成更适合继续沟通和推进的一版方案。</p>
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-xl">
          <h2 className="text-xl font-bold text-slate-900">你可以这样把创意往下推进</h2>
          <p className="mt-2 text-sm text-slate-500">先有方向，再看方案，最后进入项目池。整个过程比单纯生图更可继续。</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-amber-700 shadow-sm">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-bold text-slate-900">{step.title}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">大家都在做</h2>
            <p className="mt-2 text-sm text-slate-500">先用精选案例把平台气氛立起来，让用户看到别人也在玩、也在推进。</p>
          </div>
          <Link href="/showcase" className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline">
            查看更多案例
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredProjects.map((project) => (
            <article
              key={project.slug}
              className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50/60 transition-all duration-200 hover:-translate-y-1 hover:border-amber-200 hover:bg-white hover:shadow-[0_10px_28px_-18px_rgba(217,119,6,0.35)]"
            >
              <div className={`relative h-36 bg-gradient-to-br ${project.coverGradient}`}>
                <div className="absolute inset-x-5 top-4 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-slate-700">{project.category}</span>
                  <span className="rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-bold text-white">{project.stage}</span>
                </div>
                <div className="absolute inset-x-5 bottom-4">
                  <p className={`text-sm font-black ${project.coverAccentClass}`}>{project.popularityHint}</p>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <h3 className="text-base font-bold text-slate-900">{project.title}</h3>
                <p className="text-sm font-bold text-slate-800">{project.judgement}</p>
                <p className="text-sm leading-6 text-slate-600">{project.recentStatus}</p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link href={`/showcase/${project.slug}`} className="inline-flex text-sm font-bold text-amber-700 hover:text-amber-900">
                  看看这个方向
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-slate-900">适合哪些人先上手</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {audiences.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-emerald-100 bg-emerald-50/70 p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-emerald-950">前期判断说明</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-emerald-900">
            <p>AI 结果用于创意判断和前期推进，不代表最终打样结果。</p>
            <p>小批量与试做会结合结构、颗粒和包装做人工确认。</p>
            <p>可优先采用高品质高砖颗粒做前期方案评估。</p>
          </div>
        </div>
      </section>
    </section>
  );
}
