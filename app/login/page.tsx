"use client";

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
    <section className="mx-auto max-w-md space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">登录</h1>
        <p className="text-sm text-slate-600">请输入内测邀请码后进入系统。未登录无法访问功能页。</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">邀请码</span>
          <input
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="例如：MOC-BETA-9X2Q7K"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "验证中..." : "验证邀请码并进入"}
        </button>
      </form>

      <p className="text-xs text-slate-500">邀请码可由运营后台统一发放，支持你后续按批次更换。</p>
    </section>
  );
}
