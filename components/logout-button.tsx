"use client";

import { useRouter } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      退出登录
    </button>
  );
}
