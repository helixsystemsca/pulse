"use client";

import { WorkforceQualificationsProvider } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { TrainingOverviewDashboard } from "@/components/standards/workforce-training/TrainingOverviewDashboard";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { TRAINING_ROUTES } from "@/lib/training/routes";
import Link from "next/link";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";

/** Training → Overview: workforce readiness KPIs and alerts (aggregates Compliance data). */
export function TrainingOverviewShell() {
  const { session } = usePulseAuth();
  const leadership = trainingTeamMatrixAccess(session);

  if (!leadership) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground md:text-xl">Training overview</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-ds-muted">
            Your personal learning and completion status. Team qualification views are for administrators, management, and
            supervisors under Compliance.
          </p>
        </header>
        <TrainingEmployeeSelfView />
        <p className="text-sm text-ds-muted">
          <Link href={TRAINING_ROUTES.learning} className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
            Open Learning →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <WorkforceQualificationsProvider>
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Training overview</h2>
          <p className="max-w-3xl text-sm text-ds-muted">
            Readiness and compliance at a glance — expirations, coverage gaps, and staffing risks. Qualification truth lives
            under Compliance; workers complete items under Learning.
          </p>
        </header>
        <TrainingOverviewDashboard />
      </div>
    </WorkforceQualificationsProvider>
  );
}
