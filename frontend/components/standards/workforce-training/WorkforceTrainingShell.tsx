"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Award,
  Clock,
  Grid3X3,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { readSession } from "@/lib/pulse-session";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { cn } from "@/lib/cn";
import {
  canViewWorkforceTrainingSection,
  firstAllowedWorkforceTrainingSection,
  isWorkforceTrainingSection,
  type WorkforceTrainingSection,
} from "@/lib/standards/workforce-training-access";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
import { TrainingOverviewDashboard } from "@/components/standards/workforce-training/TrainingOverviewDashboard";
import { WorkersQualificationView } from "@/components/standards/workforce-training/WorkersQualificationView";
import { CertificationsRegistryView } from "@/components/standards/workforce-training/CertificationsRegistryView";
import { WorkforceComplianceView } from "@/components/standards/workforce-training/WorkforceComplianceView";
import { ExpiringQualificationsView } from "@/components/standards/workforce-training/ExpiringQualificationsView";

const TABS: { id: WorkforceTrainingSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "workers", label: "Workers", icon: Users },
  { id: "certifications", label: "Certifications", icon: Award },
  { id: "compliance", label: "Compliance", icon: Grid3X3 },
  { id: "expiring", label: "Expiring", icon: Clock },
];

export function WorkforceTrainingShell({ section }: { section: string }) {
  const session = readSession();
  const leadership = trainingTeamMatrixAccess(session);
  const activeSection: WorkforceTrainingSection = isWorkforceTrainingSection(section)
    ? section
    : firstAllowedWorkforceTrainingSection(session);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => canViewWorkforceTrainingSection(session, t.id)),
    [session],
  );

  if (!leadership) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground">My qualifications</h2>
          <p className="max-w-2xl text-sm text-ds-muted">
            Your assigned procedure training and credentials. Supervisors use the workforce views for team oversight.
          </p>
        </header>
        <TrainingEmployeeSelfView />
      </div>
    );
  }

  const canViewActive = canViewWorkforceTrainingSection(session, activeSection);
  const fallback = firstAllowedWorkforceTrainingSection(session);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Workforce qualifications</h2>
        <p className="max-w-3xl text-sm text-ds-muted">
          Operational compliance for supervisors, schedulers, and leadership. Procedure sign-offs remain under Procedures —
          this hub consumes their status for readiness.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-ds-border pb-2"
        aria-label="Workforce training sections"
      >
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const href = t.id === "overview" ? "/standards/training" : `/standards/training/${t.id}`;
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
          You do not have access to this section. Open a tab you are permitted to view.
        </p>
      ) : null}

      {canViewActive && activeSection === "overview" ? <TrainingOverviewDashboard /> : null}
      {canViewActive && activeSection === "workers" ? <WorkersQualificationView /> : null}
      {canViewActive && activeSection === "certifications" ? <CertificationsRegistryView /> : null}
      {canViewActive && activeSection === "compliance" ? <WorkforceComplianceView /> : null}
      {canViewActive && activeSection === "expiring" ? <ExpiringQualificationsView /> : null}

      {!canViewActive && fallback !== activeSection ? (
        <Link
          href={fallback === "overview" ? "/standards/training" : `/standards/training/${fallback}`}
          className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
        >
          Go to {TABS.find((t) => t.id === fallback)?.label ?? "Overview"}
        </Link>
      ) : null}
    </div>
  );
}
