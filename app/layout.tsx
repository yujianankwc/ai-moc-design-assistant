import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI MOC 设计助手",
  description: "AI MOC 项目创作与协作助手"
};

const navItems = [
  { href: "/", label: "首页" },
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
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-base font-semibold text-slate-900">
                AI MOC 设计助手
              </Link>
              <nav className="flex items-center gap-4 text-sm text-slate-600">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-slate-900">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
