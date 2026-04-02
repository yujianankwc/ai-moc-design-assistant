"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="relative inline-flex w-full flex-1 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:flex-none"
    >
      退出登录
    </button>
  );
}
