"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Switches between supervisor (operations) and worker dashboards. Shown on both `/overview` and `/worker`
 * so the tab state matches the URL after navigation.
 */
export function DashboardViewTabs() {
  const pathname = usePathname() || "";
  const isSupervisor = pathname === "/overview";
  const isWorker = pathname === "/worker" || pathname.startsWith("/worker/");

  const tabClass = (active: boolean) =>
    `rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "border-b-2 border-ds-success bg-ds-primary text-ds-foreground"
        : "border-b-2 border-transparent text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
    }`;

  return (
    <nav
      className="mx-auto mb-4 inline-flex flex-wrap gap-1 rounded-md border border-ds-border bg-ds-secondary p-1"
      aria-label="Dashboards"
    >
      <Link
        href="/overview"
        className={tabClass(isSupervisor)}
        prefetch={false}
        aria-current={isSupervisor ? "page" : undefined}
      >
        Supervisor dashboard
      </Link>
      <Link
        href="/worker"
        className={tabClass(isWorker)}
        prefetch={false}
        aria-current={isWorker ? "page" : undefined}
      >
        Worker dashboard
      </Link>
    </nav>
  );
}
