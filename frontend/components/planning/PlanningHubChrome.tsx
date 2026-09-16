"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects", prefix: "/projects" },
  { href: "/roadmap", label: "Roadmap", prefix: "/roadmap" },
  { href: "/project-management", label: "PM tools", prefix: "/project-management" },
];

function isActive(pathname: string, prefix: string): boolean {
  if (prefix === "/project-management") {
    return (
      pathname === "/project-management" ||
      pathname.startsWith("/project-management/") ||
      pathname === "/planning" ||
      pathname.startsWith("/planning/") ||
      pathname === "/dashboard/pm-workspace" ||
      pathname.startsWith("/dashboard/pm-workspace/") ||
      pathname === "/pm/planning" ||
      pathname.startsWith("/pm/planning/")
    );
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function PlanningHubChrome() {
  const pathname = usePathname();
  return (
    <nav data-tour="planning-hub-tabs" className="flex flex-wrap gap-2 border-b border-ds-border pb-3" aria-label="Planning views">
      {LINKS.map((l) => {
        const active = isActive(pathname, l.prefix);
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
