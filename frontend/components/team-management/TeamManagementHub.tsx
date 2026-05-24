"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkforceMetricTile } from "@/components/team-management/WorkforceMetricTile";
import {
  WORKFORCE_HUB_HERO_METRICS,
  WORKFORCE_HUB_SUPPORT_METRICS,
} from "@/lib/team-management/mock-data";
import { TEAM_MANAGEMENT_SECTIONS } from "@/lib/team-management/sections";
import { cn } from "@/lib/cn";

export function TeamManagementHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Operational leadership and workforce development — visibility, continuity, onboarding, and coordination without micromanagement."
        icon={Users}
      />

      <PageBody>
        <section aria-label="Workforce overview">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
            At a glance
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {WORKFORCE_HUB_HERO_METRICS.map((m) => (
              <WorkforceMetricTile key={m.id} metric={m} />
            ))}
          </div>
        </section>

        <section className="mt-6" aria-label="Supporting metrics">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {WORKFORCE_HUB_SUPPORT_METRICS.map((m) => (
              <WorkforceMetricTile key={m.id} metric={m} />
            ))}
          </div>
        </section>

        <section className="mt-8" aria-label="Workforce domains">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
            Explore
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TEAM_MANAGEMENT_SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={section.href}
                className={cn(
                  "ops-dash-inner-card group flex flex-col p-4 transition-shadow",
                  "hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.18)]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
                      {section.label}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                      {section.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--ds-text-primary)_35%,transparent)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ds-accent)]"
                    aria-hidden
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </PageBody>
    </div>
  );
}
