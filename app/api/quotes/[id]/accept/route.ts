import { NextResponse } from "next/server";
import { acceptQuoteForCurrentVisitor } from "@/services/project-service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const ret = await acceptQuoteForCurrentVisitor({ quoteId: id });
    return NextResponse.json({ ok: true, ...ret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "报价确认失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
