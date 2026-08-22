"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/planner", label: "Today" },
  { href: "/planner/inbox", label: "Inbox" },
  { href: "/planner/routine", label: "Routine" },
  { href: "/planner/analytics", label: "Analytics" },
];

export function PlannerChrome() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-2 border-b border-ds-border pb-3">
      {LINKS.map((l) => {
        const active = l.href === "/planner" ? pathname === "/planner" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-card hover:text-ds-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
