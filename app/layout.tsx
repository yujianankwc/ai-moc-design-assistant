import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI MOC 设计助手",
  description: "AI MOC 项目创作与协作助手"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    <html lang="en">
      <body>
        <div className="min-h-screen overflow-x-hidden">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <Link href="/" className="text-base font-semibold text-slate-900 sm:text-lg">
                AI MOC 设计助手
              </Link>
              <nav className="grid w-full grid-cols-5 gap-1 text-xs text-slate-600 sm:hidden">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-1 py-1.5 text-center text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.shortLabel}
                  </Link>
                ))}
              </nav>
              <nav className="hidden items-center gap-4 text-sm text-slate-600 sm:flex">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="whitespace-nowrap px-1 py-0.5 hover:text-slate-900">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
