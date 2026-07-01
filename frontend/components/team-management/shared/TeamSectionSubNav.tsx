"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TeamManagementSubNavItem } from "@/lib/team-management/navigation";
import { cn } from "@/lib/cn";

function activeSubNavHref(pathname: string, items: readonly TeamManagementSubNavItem[]): string | null {
  const matches = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

export function TeamSectionSubNav({
  items,
  ariaLabel,
}: {
  items: readonly TeamManagementSubNavItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname() ?? "";
  const activeHref = activeSubNavHref(pathname, items);

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-lg border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_2%,transparent)] p-1"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = activeHref === item.href;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
              active
                ? "bg-ds-secondary text-ds-foreground shadow-sm"
                : "text-ds-muted hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] hover:text-ds-foreground",
              item.future && "opacity-60",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {item.future ? <span className="ml-1 text-[9px] font-normal opacity-70">(soon)</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
