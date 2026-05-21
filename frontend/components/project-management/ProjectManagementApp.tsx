"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PlanningWorkspaceShell } from "@/components/planning/PlanningWorkspaceShell";
import { PmPlanningShell } from "@/components/pm-planning/PmPlanningShell";
import { PmWorkspaceApp } from "@/components/pm-workspace/PmWorkspaceApp";
import { canAccessPlanningWorkspace } from "@/lib/features/planning-workspace";
import { canAccessProjectManagement } from "@/lib/features/pm-project-management";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";

export type ProjectManagementTab = "workspace" | "planning" | "cpm";

function parseTab(raw: string | null): ProjectManagementTab {
  if (raw === "planning" || raw === "cpm") return raw;
  return "workspace";
}

export function ProjectManagementApp() {
  const { session } = usePulseAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const [toast, setToast] = useState<string | null>(null);

  const canPm = canAccessProjectManagement(session);
  const canPortfolio = canAccessPlanningWorkspace(session);

  if (!canPm && !canPortfolio) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-ds-border bg-ds-secondary/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-ds-foreground">Project Management</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Internal PM tools require the <span className="font-medium">PM tools</span> toggle on your user (System →
          Users), the <span className="font-medium">Project Management</span> feature on your role, and{" "}
          <code className="text-xs">projects.pm.view</code> permission. Portfolio planning requires{" "}
          <code className="text-xs">projects.view</code>.
        </p>
      </div>
    );
  }

  const tabHref = (id: ProjectManagementTab) => {
    const params = new URLSearchParams();
    params.set("tab", id);
    if (id === "planning") params.set("view", "list");
    return `${pathname}?${params.toString()}`;
  };

  const tabLink = (id: ProjectManagementTab, label: string) => (
    <Link
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
  );

  const showWorkspace = canPm;
  const showCpm = canPm;
  const showPlanning = canPortfolio;

  const effectiveTab =
    tab === "workspace" && showWorkspace
      ? "workspace"
      : tab === "cpm" && showCpm
        ? "cpm"
        : tab === "planning" && showPlanning
          ? "planning"
          : showPlanning
            ? "planning"
            : showWorkspace
              ? "workspace"
              : "cpm";

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 pb-8">
      <header>
        <h1 className="text-xl font-bold text-ds-foreground">Project Management</h1>
        <p className="text-sm text-ds-muted">
          Coordination workspace, portfolio idea backlog, and CPM/Gantt tools — separate from the public Projects list.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-ds-border" role="tablist" aria-label="Project Management views">
        {showWorkspace ? tabLink("workspace", "Workspace") : null}
        {showPlanning ? tabLink("planning", "Planning") : null}
        {showCpm ? tabLink("cpm", "CPM") : null}
      </nav>

      {toast ? (
        <div
          className="rounded-lg border border-ds-border bg-ds-primary px-4 py-3 text-sm font-medium text-ds-foreground"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {effectiveTab === "workspace" ? (
        <PmWorkspaceApp hidePageHeader />
      ) : effectiveTab === "cpm" ? (
        <PmPlanningShell variant="demo" hideWorkspaceLink />
      ) : (
        <PlanningWorkspaceShell
          onToast={setToast}
          hidePageHeader
          viewQueryKey="view"
          preserveQuery={{ tab: "planning" }}
        />
      )}
    </div>
  );
}
