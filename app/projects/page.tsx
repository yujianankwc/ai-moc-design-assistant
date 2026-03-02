import Link from "next/link";
import LogoutButton from "@/components/logout-button";
import { mapProjectStatus } from "@/lib/display-mappers";
import { listProjectsByDemoUser } from "@/services/project-service";
import type { ProjectRow } from "@/types/project";

export const dynamic = "force-dynamic";

type ProjectCardItem = {
  id: string;
  name: string;
  projectType: "轻量" | "专业";
  status: string;
  updatedAt: string;
  viewHref: string;
  viewLabel: string;
};

const mockProjects: ProjectCardItem[] = [
  {
    id: "p-001",
    name: "城市街景主题套组",
    projectType: "专业",
    status: "草稿中",
    updatedAt: "2026-02-26",
    viewHref: "/projects/p-001",
    viewLabel: "查看项目方案"
  },
  {
    id: "p-002",
    name: "海岸救援场景套组",
    projectType: "专业",
    status: "生成中",
    updatedAt: "2026-02-27",
    viewHref: "/projects/p-002",
    viewLabel: "查看项目方案"
  },
  {
    id: "p-003",
    name: "太空维修站套组",
    projectType: "专业",
    status: "已完成",
    updatedAt: "2026-02-28",
    viewHref: "/projects/p-003",
    viewLabel: "查看项目方案"
  }
];

function formatStatus(status: string) {
  return mapProjectStatus(status);
}

function isQuickProject(category: string | null | undefined) {
  return category === "quick_entry";
}

function clampTitle(value: string, maxChars = 24) {
  const compact = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(compact);
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, maxChars).join("")}…`;
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

  const projects: ProjectCardItem[] =
    dbProjects.length > 0
      ? dbProjects.map((item) => ({
          id: item.id,
          name: clampTitle(item.title || "未命名项目"),
          projectType: isQuickProject(item.category) ? "轻量" : "专业",
          status: isQuickProject(item.category) ? "轻量已生成" : formatStatus(item.status),
          updatedAt: formatDate(item.updated_at),
          viewHref: isQuickProject(item.category) ? `/quick/result?quickProjectId=${item.id}` : `/projects/${item.id}`,
          viewLabel: isQuickProject(item.category) ? "查看创意方向结果" : "查看项目方案"
        }))
      : mockProjects;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">项目列表</h1>
          <p className="text-sm text-slate-600">优先展示当前演示用户的真实项目数据。</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <LogoutButton />
          <Link
            href="/projects/new"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
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
          <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
              <h2 className="truncate text-base font-semibold text-slate-900" title={project.name}>
                {project.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    project.projectType === "轻量"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {project.projectType}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {project.status}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">最近更新：{project.updatedAt}</p>
            <div className="mt-4">
              <Link
                href={project.viewHref}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {project.viewLabel}
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
