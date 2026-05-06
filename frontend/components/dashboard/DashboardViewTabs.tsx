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
      className="mb-4 flex rounded-lg border border-ds-border bg-ds-secondary p-1 shadow-[var(--ds-shadow-card)]"
      role="navigation"
      aria-label="Dashboards"
    >
      {showWorkerTab ? (
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isWorker
              ? "bg-ds-success text-ds-on-accent shadow-sm"
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
          className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isOverview
              ? "bg-ds-success text-ds-on-accent shadow-sm"
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
          className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
            isProjectTab
              ? "bg-ds-success text-ds-on-accent shadow-sm"
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
