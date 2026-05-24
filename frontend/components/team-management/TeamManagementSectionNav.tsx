"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";

import { TEAM_MANAGEMENT_SECTIONS } from "@/lib/team-management/sections";
import { cn } from "@/lib/cn";

export function TeamManagementSectionNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] p-1"
      aria-label="Team Management sections"
    >
      <Link
        href="/team-management"
        className={cn(
          "rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
          pathname === "/team-management"
            ? "bg-[var(--ds-accent)] text-[var(--ds-on-accent)] shadow-sm"
            : "text-[color-mix(in_srgb,var(--ds-text-primary)_72%,transparent)] hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_6%,transparent)]",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden />
          Overview
        </span>
      </Link>
      {TEAM_MANAGEMENT_SECTIONS.map((section) => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
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
          >
            {section.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
