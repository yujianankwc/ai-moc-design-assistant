import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { listIntentsForAdmin } from "@/services/project-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "";
    const sourceType = url.searchParams.get("sourceType") || "";
    const keyword = url.searchParams.get("keyword") || "";
    const limit = Number(url.searchParams.get("limit") || 30);
    const offset = Number(url.searchParams.get("offset") || 0);

    const result = await listIntentsForAdmin({
      status,
      sourceType,
      keyword,
      limit,
      offset,
      adminToken: request.headers.get("x-admin-token")
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "管理端意向单读取失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
