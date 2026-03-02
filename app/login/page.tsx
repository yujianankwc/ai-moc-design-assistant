"use client";

import { useRouter } from "next/navigation";
import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_VALUE
} from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();

  const handleMockLogin = () => {
    document.cookie = `${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    const next = new URLSearchParams(window.location.search).get("next");
    const target = next && next.startsWith("/") ? next : "/projects";
    router.push(target);
    router.refresh();
  };

  return (
    <section className="mx-auto max-w-md space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">登录</h1>
        <p className="text-sm text-slate-600">
          当前为内测登录入口，本轮先使用轻量登录方式体验完整项目流程。
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">邮箱</span>
          <input
            type="email"
            placeholder="请输入你的邮箱"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">邀请码</span>
          <input
            type="text"
            placeholder="请输入邀请码（内测）"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>

        <button
          type="button"
          onClick={handleMockLogin}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          进入项目列表
        </button>
      </div>

      <p className="text-xs text-slate-500">
        当前阶段使用简化登录方式，不影响核心体验流程；后续会升级为正式认证。
      </p>
    </section>
  );
}
