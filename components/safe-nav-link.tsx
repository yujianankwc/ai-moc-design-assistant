"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MouseEvent, ReactNode } from "react";

type SafeNavLinkProps = {
  href: string;
  className?: string;
  activeClassName?: string;
  activePrefixes?: string[];
  activeExcludes?: string[];
  children: ReactNode;
};

function joinClassNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export default function SafeNavLink({
  href,
  className,
  activeClassName,
  activePrefixes,
  activeExcludes,
  children
}: SafeNavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();

  const prefixes = activePrefixes && activePrefixes.length > 0 ? activePrefixes : [href];
  const excludes = activeExcludes ?? [];
  const isActive =
    prefixes.some((prefix) => (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix))) &&
    !excludes.some((prefix) => (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)));

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    router.push(href);
    window.setTimeout(() => {
      if (window.location.pathname === currentPath && window.location.search === currentSearch) {
        window.location.assign(href);
      }
    }, 320);
  };

  return (
    <Link href={href} className={joinClassNames(className, isActive && activeClassName)} onClick={handleClick}>
      {children}
    </Link>
  );
}
