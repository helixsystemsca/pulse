"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { GROWTH_SUB_NAV, TEAM_MANAGEMENT_NAV } from "@/lib/team-management/navigation";
import { cn } from "@/lib/cn";

export function GrowthHubSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Growth"
        description="Onboarding, training, mentorship, and career progression — linked to employee development plans."
        icon={GraduationCap}
      />
      <TeamSectionSubNav items={GROWTH_SUB_NAV} ariaLabel="Growth sections" />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GROWTH_SUB_NAV.filter((item) => !item.future).map((item) => (
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
                {item.id === "onboarding"
                  ? "Standardized onboarding tracks and readiness signoffs."
                  : item.id === "training"
                    ? "Training matrix, compliance, and workforce qualifications."
                    : "Growth overview and navigation."}
              </p>
              <ArrowRight
                className="mt-3 h-4 w-4 text-ds-muted transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ds-accent)]"
                aria-hidden
              />
            </Link>
          ))}
          <Link
            href="/team-management/performance"
            className="ops-dash-inner-card group flex flex-col border-dashed p-4"
          >
            <h2 className="text-sm font-bold text-ds-foreground">Development Plans</h2>
            <p className="mt-1 flex-1 text-xs text-ds-muted">
              Plans created in Performance are managed per employee and reflected in Growth milestones.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]">
              Open Performance <ArrowRight className="h-3 w-3" aria-hidden />
            </span>
          </Link>
        </div>
        <p className="mt-6 text-xs text-ds-muted">
          Explore all Team Management areas from{" "}
          {TEAM_MANAGEMENT_NAV.map((n) => n.label).join(" · ")}.
        </p>
      </PageBody>
    </div>
  );
}
