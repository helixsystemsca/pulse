"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Award, Clock, Grid3X3, Users } from "lucide-react";
import { WorkforceQualificationsProvider } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { WorkersQualificationView } from "@/components/standards/workforce-training/WorkersQualificationView";
import { CertificationsRegistryView } from "@/components/standards/workforce-training/CertificationsRegistryView";
import { WorkforceComplianceView } from "@/components/standards/workforce-training/WorkforceComplianceView";
import { ExpiringQualificationsView } from "@/components/standards/workforce-training/ExpiringQualificationsView";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { trainingComplianceHref } from "@/lib/training/routes";
import {
  canViewTrainingComplianceSection,
  firstAllowedTrainingComplianceSection,
  isTrainingComplianceSection,
  type TrainingComplianceSection,
} from "@/lib/training/training-domain-access";

const TABS: { id: TrainingComplianceSection; label: string; icon: typeof Grid3X3 }[] = [
  { id: "matrix", label: "Matrix", icon: Grid3X3 },
  { id: "workers", label: "Workforce", icon: Users },
  { id: "registry", label: "Certifications", icon: Award },
  { id: "queues", label: "Expiring & gaps", icon: Clock },
];

/** Training → Compliance: unified qualification engine (matrix-first). */
export function TrainingComplianceShell({ section }: { section: string }) {
  const { session } = usePulseAuth();
  const activeSection: TrainingComplianceSection = isTrainingComplianceSection(section)
    ? section
    : firstAllowedTrainingComplianceSection(session);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => canViewTrainingComplianceSection(session, t.id)),
    [session],
  );

  const canViewActive = canViewTrainingComplianceSection(session, activeSection);
  const fallback = firstAllowedTrainingComplianceSection(session);

  return (
    <WorkforceQualificationsProvider>
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Compliance</h2>
          <p className="max-w-3xl text-sm text-ds-muted">
            Authoritative workforce qualification state — matrix, registry, expirations, and readiness. Schedules and
            dashboards consume this data; workers complete items under Learning.
          </p>
        </header>

        <nav className="flex flex-wrap gap-1 border-b border-ds-border pb-2" aria-label="Compliance views">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const href = trainingComplianceHref(t.id);
            const isActive = activeSection === t.id;
            return (
              <Link
                key={t.id}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-ds-primary text-white"
                    : "text-ds-muted hover:bg-ds-muted/30 hover:text-ds-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </nav>

        {!canViewActive ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
            You do not have access to this view.
          </p>
        ) : null}

        {canViewActive && activeSection === "matrix" ? <WorkforceComplianceView /> : null}
        {canViewActive && activeSection === "workers" ? <WorkersQualificationView /> : null}
        {canViewActive && activeSection === "registry" ? <CertificationsRegistryView /> : null}
        {canViewActive && activeSection === "queues" ? <ExpiringQualificationsView /> : null}

        {!canViewActive && fallback !== activeSection ? (
          <Link
            href={trainingComplianceHref(fallback)}
            className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            Go to {TABS.find((t) => t.id === fallback)?.label ?? "Matrix"}
          </Link>
        ) : null}
      </div>
    </WorkforceQualificationsProvider>
  );
}
