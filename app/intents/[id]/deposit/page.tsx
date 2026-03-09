"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function IntentDepositPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const intentId = params?.id || "";
  const [amount, setAmount] = useState("");
  const [paymentChannel, setPaymentChannel] = useState("微信");
  const [voucherNote, setVoucherNote] = useState("");
  const [voucherUrl, setVoucherUrl] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeedback("请填写有效的定金金额。");
      return;
    }

    setIsSubmitting(true);
    setFeedback("");
    try {
      const res = await fetch(`/api/intents/${intentId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          paymentChannel: paymentChannel.trim(),
          voucherNote: voucherNote.trim(),
          voucherUrl: voucherUrl.trim()
        })
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || "这笔定金凭证暂时没有记下来，请稍后重试。");
      setFeedback("定金凭证已提交，意向单已进入锁单状态。");
      setTimeout(() => {
        router.push(`/intents/${intentId}`);
      }, 800);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "这笔定金凭证暂时没有记下来，请稍后重试。";
      setFeedback(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">补上定金凭证</h1>
        <p className="mt-1 text-sm text-slate-600">这一步用于继续推进当前意向，补上金额、支付方式和凭证说明即可。</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">定金金额（元）*</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="例如：1999"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs text-slate-500">支付方式</span>
            <input
              value={paymentChannel}
              onChange={(event) => setPaymentChannel(event.target.value)}
              placeholder="微信 / 支付宝 / 对公转账"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1 text-sm text-slate-700">
          <span className="text-xs text-slate-500">凭证说明（可选，和链接二选一）</span>
          <textarea
            value={voucherNote}
            onChange={(event) => setVoucherNote(event.target.value)}
            rows={3}
            placeholder="例如：已于 3 月 5 日 18:20 支付，尾号 8891"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block space-y-1 text-sm text-slate-700">
          <span className="text-xs text-slate-500">凭证链接（可选，和说明二选一）</span>
          <input
            value={voucherUrl}
            onChange={(event) => setVoucherUrl(event.target.value)}
            placeholder="可填写网盘/图床链接"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {isSubmitting ? "提交中..." : "提交这笔定金凭证"}
          </button>
          <Link
            href={`/intents/${intentId}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            返回详情
          </Link>
        </div>
        {feedback && <p className="mt-3 text-sm text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}
