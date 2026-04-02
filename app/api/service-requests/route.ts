import { NextResponse } from "next/server";
import { createServiceRequestForCurrentVisitor, listServiceRequestsForCurrentVisitor } from "@/services/project-service";
import type { CreateServiceRequestInput, ServiceRequestStatus, ServiceRequestType } from "@/types/service-request";

function isValidRequestType(value: string): value is ServiceRequestType {
  return value === "bom_review" || value === "sampling_review" || value === "creator_plan";
}

function isValidStatus(value: string): value is ServiceRequestStatus {
  return value === "pending" || value === "reviewing" || value === "responded" || value === "converted" || value === "closed";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateServiceRequestInput;

    if (
      !body ||
      !isUuid(body.projectId) ||
      !isValidRequestType(body.requestType) ||
      !body.contactInfo?.trim() ||
      !body.requestNote?.trim()
    ) {
      return NextResponse.json({ error: "申请参数不完整，请检查后重试。" }, { status: 400 });
    }

    const created = await createServiceRequestForCurrentVisitor(body);
    return NextResponse.json({ requestId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "申请提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 20);
    const offset = Number(url.searchParams.get("offset") || 0);
    const statusRaw = url.searchParams.get("status") || "";
    const status = isValidStatus(statusRaw) ? statusRaw : "";

    const result = await listServiceRequestsForCurrentVisitor({ limit, offset, status });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务申请列表读取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
