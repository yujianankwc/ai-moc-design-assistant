import { NextResponse } from "next/server";
import { getHttpStatusFromErrorMessage } from "@/lib/api-error";
import { updateIntentShowcaseControlForAdmin } from "@/services/project-service";

type Body = {
  featured?: boolean;
  homepage?: boolean;
  paused?: boolean;
  actorId?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Body;

    const ret = await updateIntentShowcaseControlForAdmin({
      intentId: id,
      control: {
        featured: body.featured,
        homepage: body.homepage,
        paused: body.paused
      },
      actorId: body.actorId,
      adminToken: request.headers.get("x-admin-token")
    });

    return NextResponse.json({ ok: true, ...ret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "公开展示控制更新失败";
    return NextResponse.json({ error: message }, { status: getHttpStatusFromErrorMessage(message) });
  }
}
