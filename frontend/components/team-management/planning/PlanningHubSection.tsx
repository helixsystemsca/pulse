"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PLANNING_SUB_NAV } from "@/lib/team-management/navigation";
import { cn } from "@/lib/cn";

export function PlanningHubSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning"
        description="Hiring pipelines, workforce planning, capacity, and headcount forecasting."
        icon={ClipboardList}
      />
      <TeamSectionSubNav items={PLANNING_SUB_NAV} ariaLabel="Planning sections" />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2">
          {PLANNING_SUB_NAV.filter((item) => !item.future && item.id !== "hub").map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "ops-dash-inner-card group flex flex-col p-4 transition-shadow",
                "hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.18)]",
              )}
            >
              <h2 className="text-sm font-bold text-ds-foreground">{item.label}</h2>
              <p className="mt-1 flex-1 text-xs text-ds-muted">
                {item.id === "hiring"
                  ? "Candidate pipeline, interviews, and onboarding readiness."
                  : "Continuity, forecasting, and staffing coverage."}
              </p>
              <ArrowRight
                className="mt-3 h-4 w-4 text-ds-muted transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ds-accent)]"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
