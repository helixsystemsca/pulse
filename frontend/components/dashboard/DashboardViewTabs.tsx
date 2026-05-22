"use client";

import { usePathname, useRouter } from "next/navigation";

import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";

/**
 * Switches between operations, leadership, and projects dashboards. URL is the source of truth.
 *
 * - `toolbar` — frosted segmented control (operations dashboard header).
 * - `segmented-card` — legacy grouped pill inside a grey card (kept for one-off layouts).
 */
export function DashboardViewTabs({
  variant = "toolbar",
  className,
}: {
  variant?: "toolbar" | "segmented-card";
  className?: string;
}) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { session } = usePulseAuth();
  const isProjectTab = pathname === "/overview/project" || pathname.startsWith("/overview/project/");
  const isOverview = pathname === "/overview" || (pathname.startsWith("/overview/") && !isProjectTab);
  const isWorker = pathname === "/worker" || pathname.startsWith("/worker/");

  const canSeeBoth = sessionHasAnyRole(session, "company_admin", "manager", "supervisor", "lead");
  const primary = sessionPrimaryRole(session);
  const showWorkerTab = true;
  const demo = session?.role === "demo_viewer";
  const showOverviewTab =
    (primary !== "worker" || canSeeBoth) &&
    (!session || demo || canAccessClassicNavHref(session, "/overview"));
  const showProjectTab =
    (primary !== "worker" || canSeeBoth) &&
    (!session ||
      demo ||
      (canAccessClassicNavHref(session, "/overview/project") && Boolean(session.can_use_pm_features)));

  const items = [
    { key: "worker", label: "Operations", show: showWorkerTab, active: isWorker, onClick: () => router.push("/worker") },
    { key: "overview", label: "Leadership", show: showOverviewTab, active: isOverview, onClick: () => router.push("/overview") },
    {
      key: "project",
      label: "Projects",
      show: showProjectTab,
      active: isProjectTab,
      onClick: () => router.push("/overview/project"),
    },
  ].filter((x) => x.show);

  if (items.length === 0) return null;

  if (variant === "segmented-card") {
    return (
      <div
        className={cn(
          "ds-card-secondary ds-card-static mb-4 inline-flex w-fit max-w-full rounded-lg p-1",
          className,
        )}
        role="navigation"
        aria-label="Dashboards"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-center text-xs font-semibold transition-colors sm:text-sm",
              item.active
                ? "cursor-default bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
                : "text-ds-muted hover:bg-ds-interactive-hover hover:text-ds-foreground",
            )}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("ops-dash-segment", className)} role="navigation" aria-label="Dashboard views">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cn("ops-dash-segment-btn", item.active && "ops-dash-segment-btn--active")}
          aria-current={item.active ? "page" : undefined}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
