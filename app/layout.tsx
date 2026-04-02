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
  { href: "/quick/new", label: "试创意", shortLabel: "试创意" },
  { href: "/showcase", label: "看内容", shortLabel: "看内容" },
  { href: "/projects", label: "我的", shortLabel: "我的" }
];

function getActivePrefixes(href: string) {
  if (href === "/projects") return ["/projects"];
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
          <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
              <div className="flex flex-col">
                <SafeNavLink href="/" className="text-base font-extrabold tracking-tight text-slate-900 transition-colors hover:text-slate-600 sm:text-lg">
                  AI积木设计师
                </SafeNavLink>
                <p className="mt-1 text-xs tracking-[0.14em] text-slate-400">人人都是积木设计师</p>
              </div>
              <nav className="grid w-full grid-cols-3 gap-2 text-xs sm:hidden">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={getActivePrefixes(item.href)}
                    className="min-w-0 rounded-full border border-slate-200 bg-white px-2 py-2 text-center font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
                    activeClassName="!border-slate-950 !bg-slate-950 !text-white font-bold shadow-[0_8px_20px_-16px_rgba(15,23,42,0.65)]"
                  >
                    {item.shortLabel}
                  </SafeNavLink>
                ))}
              </nav>
              <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 text-sm shadow-[0_12px_24px_-22px_rgba(15,23,42,0.18)] sm:flex">
                {navItems.map((item) => (
                  <SafeNavLink
                    key={item.href}
                    href={item.href}
                    activePrefixes={getActivePrefixes(item.href)}
                    className="whitespace-nowrap rounded-full px-3.5 py-1.5 font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
                    activeClassName="bg-slate-950 text-white font-bold shadow-[0_10px_22px_-16px_rgba(15,23,42,0.5)]"
                  >
                    {item.label}
                  </SafeNavLink>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-12">{children}</main>
          <footer className="border-t border-white/60 bg-white/55 py-4 backdrop-blur-sm">
            <p className="mx-auto w-full max-w-6xl px-4 text-center text-[11px] tracking-[0.1em] text-slate-400 sm:px-6">
              人人都是积木设计师。万物皆可积木
            </p>
            <p className="mx-auto mt-1 w-full max-w-6xl px-4 text-center text-[11px] text-slate-400 sm:px-6">
              鲁ICP备2020043483号-1，©2020-2026 酷玩潮®
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
