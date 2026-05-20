"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PlanningListTab } from "@/components/planning/PlanningListTab";
import { PlanningPlaceholderTab } from "@/components/planning/PlanningPlaceholderTab";
import { cn } from "@/lib/cn";

export type PlanningWorkspaceTab = "calendar" | "timeline" | "forecast" | "capacity" | "list";

const TABS: { id: PlanningWorkspaceTab; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "timeline", label: "Timeline" },
  { id: "forecast", label: "Forecast" },
  { id: "capacity", label: "Capacity" },
  { id: "list", label: "List" },
];

function parseTab(raw: string | null): PlanningWorkspaceTab {
  if (raw === "calendar" || raw === "timeline" || raw === "forecast" || raw === "capacity" || raw === "list") {
    return raw;
  }
  return "list";
}

type Props = {
  onToast: (message: string) => void;
};

export function PlanningWorkspaceShell({ onToast }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const tabHref = (id: PlanningWorkspaceTab) => `${pathname}?tab=${id}`;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-10">
      <header>
        <h1 className="text-xl font-bold text-ds-foreground">Planning</h1>
        <p className="text-sm text-ds-muted">
          Portfolio calendar, capacity views, and the project idea backlog before formal approval.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-ds-border" role="tablist" aria-label="Planning views">
        {TABS.map(({ id, label }) => (
          <Link
            key={id}
            href={tabHref(id)}
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              tab === id
                ? "border-[var(--ds-accent)] text-ds-foreground"
                : "border-transparent text-ds-muted hover:text-ds-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "list" ? (
        <PlanningListTab onToast={onToast} />
      ) : tab === "calendar" ? (
        <PlanningPlaceholderTab
          title="Calendar"
          description="Cross-project calendar and milestone overlays will appear here."
        />
      ) : tab === "timeline" ? (
        <PlanningPlaceholderTab
          title="Timeline"
          description="Multi-project timeline and dependency views are coming soon."
        />
      ) : tab === "forecast" ? (
        <PlanningPlaceholderTab
          title="Forecast"
          description="Demand and staffing forecast models will connect to schedule history."
        />
      ) : (
        <PlanningPlaceholderTab
          title="Capacity"
          description="Resource capacity and constraint planning will live in this view."
        />
      )}
    </div>
  );
}
