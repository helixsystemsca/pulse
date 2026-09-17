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
    <nav data-tour="planner-tabs" className="mb-4 flex flex-wrap gap-2 border-b border-ds-border pb-3">
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

export function PlannerToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[250] max-w-md -translate-x-1/2 rounded-md border border-ds-border bg-ds-card px-4 py-3 text-sm font-medium text-ds-foreground shadow-lg"
    >
      {message}
    </div>
  );
}
