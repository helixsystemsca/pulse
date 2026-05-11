"use client";

import { usePathname, useRouter } from "next/navigation";

import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { sessionHasAnyRole, sessionPrimaryRole } from "@/lib/pulse-roles";

const VIEW_TAB_TOOLBAR =
  "rounded-lg border-2 border-ds-border bg-transparent px-3 py-2 text-center text-xs font-semibold text-ds-foreground shadow-none transition-colors sm:text-sm hover:border-[var(--ds-accent)] hover:bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-bg))] hover:text-[var(--ds-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent)] dark:hover:bg-[color-mix(in_srgb,var(--ds-accent)_18%,transparent)]";

const VIEW_TAB_TOOLBAR_ACTIVE =
  "border-0 bg-[var(--ds-accent)] text-white shadow-sm hover:border-0 hover:bg-[color-mix(in_srgb,var(--ds-accent)_88%,#0f172a)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80";

/**
 * Switches between operations, leadership, and projects dashboards. URL is the source of truth.
 *
 * - `toolbar` — individual bordered buttons (for embedding in dashboard headers).
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
  const showOverviewTab = primary !== "worker" || canSeeBoth;
  const showProjectTab = primary !== "worker" || canSeeBoth;

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
                ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm"
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
    <div
      className={cn("inline-flex max-w-full flex-wrap items-center gap-1", className)}
      role="navigation"
      aria-label="Dashboard views"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cn(VIEW_TAB_TOOLBAR, item.active && VIEW_TAB_TOOLBAR_ACTIVE)}
          aria-current={item.active ? "page" : undefined}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
