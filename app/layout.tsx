import type { Metadata, Viewport } from "next/dist/lib/metadata/types/metadata-interface.js";
import SafeNavLink from "@/components/safe-nav-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI积木设计师",
  description: "人人都是积木设计师。万物皆可积木。"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover"
};

const navItems = [
  { href: "/", label: "首页", shortLabel: "首页" },
  { href: "/quick/new", label: "试创意", shortLabel: "试创意" },
  { href: "/showcase", label: "灵感广场", shortLabel: "广场" },
  { href: "/projects", label: "我的项目", shortLabel: "项目" },
  { href: "/intents", label: "我的意向", shortLabel: "意向" },
  { href: "/login", label: "登录", shortLabel: "登录" }
];

function getActivePrefixes(href: string) {
  if (href === "/projects") return ["/projects"];
  if (href === "/intents") return ["/intents"];
  if (href === "/quick/new") return ["/quick"];
  if (href === "/showcase") return ["/showcase"];
  return [href];
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="overflow-x-hidden">
      <body className="overflow-x-hidden">
        <div className="flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-hidden">
          <header className="sticky top-0 z-40 border-b border-amber-100/80 bg-gradient-to-b from-amber-50/70 to-white/95 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <div className="flex flex-col">
                <SafeNavLink href="/" className="text-base font-extrabold tracking-tight text-slate-900 transition-colors hover:text-amber-700 sm:text-lg">
                  AI积木设计师
                </SafeNavLink>
                <p className="mt-0.5 text-xs text-slate-500">人人都是积木设计师</p>
              </div>
              <nav className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-amber-100 bg-white/80 p-1 text-xs shadow-[0_6px_20px_-18px_rgba(217,119,6,0.5)] sm:hidden">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={getActivePrefixes(item.href)}
                    className="rounded-xl px-1 py-1.5 text-center font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-50 hover:text-amber-700"
                    activeClassName="bg-amber-100 text-amber-900 font-extrabold shadow-[0_3px_0_0_#f59e0b]"
                  >
                    {item.shortLabel}
                  </SafeNavLink>
                ))}
              </nav>
              <nav className="hidden items-center gap-1 rounded-2xl border border-amber-100 bg-white/85 p-1 text-sm shadow-[0_8px_24px_-20px_rgba(217,119,6,0.55)] sm:flex">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={getActivePrefixes(item.href)}
                    className="whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-50 hover:text-amber-700"
                    activeClassName="bg-amber-100 text-amber-900 font-extrabold shadow-[0_3px_0_0_#f59e0b]"
                  >
                    {item.label}
                  </SafeNavLink>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6 sm:py-10">{children}</main>
          <footer className="border-t border-slate-100 bg-white/80 py-3">
            <p className="mx-auto w-full max-w-5xl px-4 text-center text-[11px] text-slate-400 sm:px-6">
              人人都是积木设计师。万物皆可积木
            </p>
            <p className="mx-auto mt-1 w-full max-w-5xl px-4 text-center text-[11px] text-slate-400 sm:px-6">
              鲁ICP备2020043483号-1，©2020-2026 酷玩潮®
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
