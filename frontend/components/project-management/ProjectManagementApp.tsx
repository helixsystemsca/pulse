"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PmPlanningShell } from "@/components/pm-planning/PmPlanningShell";
import { PmWorkspaceApp } from "@/components/pm-workspace/PmWorkspaceApp";
import { canAccessProjectManagement } from "@/lib/features/pm-project-management";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";

export type ProjectManagementTab = "workspace" | "planning";

function parseTab(raw: string | null): ProjectManagementTab {
  return raw === "planning" ? "planning" : "workspace";
}

export function ProjectManagementApp() {
  const { session } = usePulseAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const allowed = canAccessProjectManagement(session);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-ds-border bg-ds-secondary/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-ds-foreground">Project Management</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Internal PM tools require the <span className="font-medium">PM tools</span> toggle on your user (System →
          Users), the <span className="font-medium">Project Management</span> feature on your role, and{" "}
          <code className="text-xs">projects.pm.view</code> permission.
        </p>
      </div>
    );
  }

  const tabHref = (id: ProjectManagementTab) => `${pathname}?tab=${id}`;

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

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 pb-8">
      <header>
        <h1 className="text-xl font-bold text-ds-foreground">Project Management</h1>
        <p className="text-sm text-ds-muted">
          Internal coordination workspace and CPM planning tools — separate from the public Projects list.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-ds-border" role="tablist" aria-label="Project Management views">
        {tabLink("workspace", "Workspace")}
        {tabLink("planning", "Planning")}
      </nav>

      {tab === "workspace" ? <PmWorkspaceApp hidePageHeader /> : <PmPlanningShell variant="demo" hideWorkspaceLink />}
    </div>
  );
}
