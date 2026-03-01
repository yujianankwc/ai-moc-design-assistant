import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import { mapProjectStatus } from "@/lib/display-mappers";
import { listProjectsByDemoUser } from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

export const dynamic = "force-dynamic";

const mockProjects = [
  {
    id: "p-001",
    name: "城市街景主题套组",
    status: "草稿中",
    updatedAt: "2026-02-26"
  },
  {
    id: "p-002",
    name: "海岸救援场景套组",
    status: "生成中",
    updatedAt: "2026-02-27"
  },
  {
    id: "p-003",
    name: "太空维修站套组",
    status: "已完成",
    updatedAt: "2026-02-28"
  }
];

function formatStatus(status: string) {
  return mapProjectStatus(status);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN");
}

export default async function ProjectsPage() {
  let dbProjects: ProjectRow[] = [];

  try {
    dbProjects = await listProjectsByDemoUser();
  } catch {
    dbProjects = [];
  }

  const projects =
    dbProjects.length > 0
      ? dbProjects.map((item) => ({
          id: item.id,
          name: item.title || "未命名项目",
          status: formatStatus(item.status),
          updatedAt: formatDate(item.updated_at)
        }))
      : mockProjects;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">项目列表</h1>
          <p className="text-sm text-slate-600">优先展示当前演示用户的真实项目数据。</p>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton />
          <Link
            href="/projects/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            新建项目
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">搜索项目（占位）</span>
          <input
            type="text"
            placeholder="输入项目名关键词"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">{project.name}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {project.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">最近更新：{project.updatedAt}</p>
            <div className="mt-4">
              <Link
                href={`/projects/${project.id}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                查看项目方案
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        暂无真实项目数据时，会自动展示演示项目卡片。
      </div>
    </section>
  );
}
