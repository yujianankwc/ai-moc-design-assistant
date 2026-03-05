import type { Metadata, Viewport } from "next";
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
  { href: "/quick/new", label: "轻量入口", shortLabel: "轻量" },
  { href: "/login", label: "登录", shortLabel: "登录" },
  { href: "/projects", label: "项目列表", shortLabel: "列表" },
  { href: "/projects/new", label: "创建项目", shortLabel: "创建" }
];

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="overflow-x-hidden">
      <body className="overflow-x-hidden">
        <div className="flex min-h-screen w-full max-w-[100vw] flex-col overflow-x-hidden">
          <header className="relative z-40 border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <div className="flex flex-col">
                <SafeNavLink href="/" className="text-base font-semibold text-slate-900 sm:text-lg">
                  AI积木设计师
                </SafeNavLink>
                <p className="mt-0.5 text-xs text-slate-500">人人都是积木设计师</p>
              </div>
              <nav className="grid w-full grid-cols-5 gap-1 text-xs text-slate-600 sm:hidden">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={
                      item.href === "/projects"
                        ? ["/projects"]
                        : item.href === "/quick/new"
                          ? ["/quick"]
                          : [item.href]
                    }
                    activeExcludes={item.href === "/projects" ? ["/projects/new"] : undefined}
                    className="rounded-md px-1 py-1.5 text-center text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    activeClassName="bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
                  >
                    {item.shortLabel}
                  </SafeNavLink>
                ))}
              </nav>
              <nav className="hidden items-center gap-4 text-sm text-slate-600 sm:flex">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={
                      item.href === "/projects"
                        ? ["/projects"]
                        : item.href === "/quick/new"
                          ? ["/quick"]
                          : [item.href]
                    }
                    activeExcludes={item.href === "/projects" ? ["/projects/new"] : undefined}
                    className="whitespace-nowrap rounded px-2 py-1 hover:text-slate-900"
                    activeClassName="bg-slate-100 text-slate-900"
                  >
                    {item.label}
                  </SafeNavLink>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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
