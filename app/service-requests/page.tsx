import Link from "next/link";
import { listServiceRequestsForDemoUser } from "@/services/project-service";
import type { ServiceRequestRow, ServiceRequestStatus, ServiceRequestType } from "@/types/service-request";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function mapRequestTypeLabel(value: ServiceRequestType) {
  if (value === "bom_review") return "零件与结构补充";
  if (value === "sampling_review") return "试做路径申请";
  return "原创计划申请";
}

function mapRequestStatusLabel(value: ServiceRequestStatus) {
  if (value === "pending") return "待处理";
  if (value === "reviewing") return "处理中";
  if (value === "responded") return "已回复";
  if (value === "converted") return "已转后续推进";
  return "已关闭";
}

export default async function ServiceRequestsPage() {
  let items: ServiceRequestRow[] = [];
  try {
    const result = await listServiceRequestsForDemoUser({ limit: 50 });
    items = result.items;
  } catch {
    items = [];
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">我的服务申请</h1>
          <p className="mt-1 text-sm text-slate-600">这里会显示你提交过的零件补充、试做路径和原创计划申请，方便继续查看处理进度。</p>
        </div>
        <Link href="/projects" className="text-sm text-blue-700 hover:underline">
          回到我的项目
        </Link>
      </div>

      {items.length === 0 ? (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 text-center text-sm text-slate-600">
          <h2 className="text-lg font-bold text-slate-900">你还没有提交服务申请</h2>
          <p className="mt-2">可以先进入项目详情页，在对应方向里补充试做路径、原创计划或结构信息。</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white"
            >
              去看我的项目
            </Link>
            <Link
              href="/quick/new"
              className="inline-flex items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
            >
              再试一个新方向
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs font-bold text-white">
                  {mapRequestStatusLabel(item.status)}
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                  {mapRequestTypeLabel(item.request_type)}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold text-slate-900">{item.project_title || "未命名项目"}</h2>
              <p className="mt-2 text-sm text-slate-600">联系方式：{item.contact_info}</p>
              <p className="mt-2 text-sm text-slate-700">{item.request_note}</p>
              {item.operator_note ? (
                <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">当前处理备注</p>
                  <p className="mt-1 text-sm text-slate-700">{item.operator_note}</p>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-slate-500">提交时间：{formatDate(item.created_at)}</p>
              <p className="mt-1 text-xs text-slate-500">最近更新：{formatDate(item.updated_at)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
