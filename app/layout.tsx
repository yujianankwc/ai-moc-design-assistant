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
  { href: "/", label: "首页" },
  { href: "/quick/new", label: "轻量入口" },
  { href: "/login", label: "登录" },
  { href: "/projects", label: "项目列表" },
  { href: "/projects/new", label: "创建项目" }
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
              <nav className="-mx-1 flex w-full items-center gap-3 overflow-x-auto px-1 text-sm text-slate-600 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="shrink-0 whitespace-nowrap px-1 py-0.5 hover:text-slate-900">
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
