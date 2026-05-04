"use client";

import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/cn";

const tabBtn =
  "min-h-9 flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-ds-secondary sm:px-4";

const tabActive = "bg-ds-primary text-ds-foreground shadow-sm ring-1 ring-ds-border";

const tabInactive =
  "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground active:bg-ds-muted/40 dark:hover:bg-ds-interactive-hover";

/**
 * Switches between overview (supervisor) and worker dashboards. URL is the source of truth.
 */
export function DashboardViewTabs() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const isProjectTab = pathname === "/overview/project" || pathname.startsWith("/overview/project/");
  const isOverview = pathname === "/overview" || (pathname.startsWith("/overview/") && !isProjectTab);
  const isWorker = pathname === "/worker" || pathname.startsWith("/worker/");

  return (
    <div
      className="mb-4 flex rounded-lg border border-ds-border bg-ds-secondary p-1 shadow-[var(--ds-shadow-card)]"
      role="navigation"
      aria-label="Dashboards"
    >
      <button type="button" className={cn(tabBtn, isWorker ? tabActive : tabInactive)} onClick={() => router.push("/worker")}>
        Worker
      </button>
      <button type="button" className={cn(tabBtn, isOverview ? tabActive : tabInactive)} onClick={() => router.push("/overview")}>
        Overview
      </button>
      <button
        type="button"
        className={cn(tabBtn, isProjectTab ? tabActive : tabInactive)}
        onClick={() => router.push("/overview/project")}
      >
        Project
      </button>
    </div>
  );
}
