import { NextResponse } from "next/server";
import { submitDepositForCurrentVisitor } from "@/services/project-service";

type Body = {
  amount?: number;
  paymentChannel?: string;
  voucherNote?: string;
  voucherUrl?: string;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    const ret = await submitDepositForCurrentVisitor({
      intentId: id,
      amount: Number(body?.amount || 0),
      paymentChannel: body?.paymentChannel,
      voucherNote: body?.voucherNote,
      voucherUrl: body?.voucherUrl
    });
    return NextResponse.json({ ok: true, ...ret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "定金凭证提交失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
