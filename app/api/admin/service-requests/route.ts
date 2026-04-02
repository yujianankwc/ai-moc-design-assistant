import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { listServiceRequestsForAdmin } from "@/services/project-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const keyword = url.searchParams.get("keyword") || "";
    const limit = Number(url.searchParams.get("limit") || 50);
    const offset = Number(url.searchParams.get("offset") || 0);

    const result = await listServiceRequestsForAdmin({
      status,
      keyword,
      limit,
      offset,
      adminToken: request.headers.get("x-admin-token")
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端服务申请列表读取失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
