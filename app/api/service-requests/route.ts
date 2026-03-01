import { NextResponse } from "next/server";
import { createServiceRequestForDemoUser } from "@/services/project-service";
import type { CreateServiceRequestInput, ServiceRequestType } from "@/types/service-request";

function isValidRequestType(value: string): value is ServiceRequestType {
  return value === "bom_review" || value === "sampling_review" || value === "creator_plan";
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

    const created = await createServiceRequestForDemoUser(body);
    return NextResponse.json({ requestId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "申请提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
