"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteCode.trim()) {
      setError("请输入邀请码。");
      return;
    }
    setIsSubmitting(true);
    setError("");

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode })
      });
    } catch {
      setError("网络异常，请检查连接后重试。");
      setIsSubmitting(false);
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error || "登录失败，请稍后重试。");
      setIsSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <section className="mx-auto max-w-md space-y-6 pt-10">
      <div className="space-y-3 text-center sm:text-left">
        <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          AI积木设计师 · 先开始
        </p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">先输入邀请码继续</h1>
        <p className="text-sm font-medium text-slate-600">输完就能继续刚才那一步，不用重新来。</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="space-y-5 rounded-[28px] border-2 border-amber-100 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(217,119,6,0.35)] sm:p-8"
      >
        <label className="block space-y-3">
          <span className="text-sm font-bold text-slate-800">邀请码</span>
          <input
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="输入邀请码"
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm font-bold uppercase tracking-wider outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
          />
        </label>

        {error ? <p className="text-xs font-bold text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="relative inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-400 px-5 py-3 text-base font-extrabold tracking-wide text-amber-950 shadow-[0_6px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-[0_2px_0_0_#d97706] disabled:pointer-events-none disabled:opacity-60"
        >
          {isSubmitting ? "验证中..." : "输入后继续"}
        </button>
      </form>

      <div className="space-y-2 text-center sm:text-left">
        <p className="text-xs font-medium text-slate-500">没有邀请码的话，先找运营拿一个，再回来继续就行。</p>
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-slate-700 transition hover:text-slate-950"
        >
          先回首页看看
        </Link>
      </div>
    </section>
  );
}
