"use client";

import { usePathname, useRouter } from "next/navigation";

import { usePulseAuth } from "@/hooks/usePulseAuth";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";

/**
 * Switches between overview (supervisor) and worker dashboards. URL is the source of truth.
 */
export function DashboardViewTabs() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { session } = usePulseAuth();
  const isProjectTab = pathname === "/overview/project" || pathname.startsWith("/overview/project/");
  const isOverview = pathname === "/overview" || (pathname.startsWith("/overview/") && !isProjectTab);
  const isWorker = pathname === "/worker" || pathname.startsWith("/worker/");

  const canSeeBoth = sessionHasAnyRole(session, "company_admin", "manager", "supervisor", "lead");
  const primary = sessionPrimaryRole(session);
  const showWorkerTab = true;
  const showOverviewTab = primary !== "worker" || canSeeBoth;
  const showProjectTab = primary !== "worker" || canSeeBoth;

  return (
    <div
      className="ds-card-secondary ds-card-static mb-4 inline-flex w-fit max-w-full rounded-lg p-1"
      role="navigation"
      aria-label="Dashboards"
    >
      {showWorkerTab ? (
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isWorker
              ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
              : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
          }`}
          onClick={() => router.push("/worker")}
        >
          Operations
        </button>
      ) : null}
      {showOverviewTab ? (
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isOverview
              ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
              : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
          }`}
          onClick={() => router.push("/overview")}
        >
          Leadership
        </button>
      ) : null}
      {showProjectTab ? (
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isProjectTab
              ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
              : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground"
          }`}
          onClick={() => router.push("/overview/project")}
        >
          Projects
        </button>
      ) : null}
    </div>
  );
}
