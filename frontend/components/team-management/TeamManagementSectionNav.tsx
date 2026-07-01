"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TEAM_MANAGEMENT_NAV, isTeamManagementNavActive } from "@/lib/team-management/navigation";
import { cn } from "@/lib/cn";

export function TeamManagementSectionNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] p-1"
      aria-label="Team Management sections"
    >
      {TEAM_MANAGEMENT_NAV.map((section) => {
        const Icon = section.icon;
        const active = isTeamManagementNavActive(section.href, pathname);
        return (
          <Link
            key={section.id}
            href={section.href}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--ds-accent)] text-[var(--ds-on-accent)] shadow-sm"
                : "text-[color-mix(in_srgb,var(--ds-text-primary)_72%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_6%,transparent)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {section.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
