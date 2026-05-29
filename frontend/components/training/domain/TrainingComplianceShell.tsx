"use client";

import Link from "next/link";
import { useMemo } from "react";
import { WorkforceQualificationsProvider } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { WorkforceQualificationHub } from "@/components/standards/workforce-training/WorkforceQualificationHub";
import { WorkforceComplianceView } from "@/components/standards/workforce-training/WorkforceComplianceView";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import {
  TRAINING_ROUTES,
  workforcePanelFromComplianceSection,
  workforcePanelFromSearchParams,
  type WorkforceQualificationPanel,
} from "@/lib/training/routes";
import {
  canViewAnyTrainingCompliance,
  canViewTrainingComplianceSection,
  firstAllowedTrainingComplianceSection,
  isTrainingComplianceSection,
  type TrainingComplianceSection,
} from "@/lib/training/training-domain-access";
import {
  uiCalloutWarning,
  uiPageDescription,
  uiPageStack,
  uiPageTitle,
  uiTextLink,
} from "@/styles/ui-classes";

const WORKFORCE_SECTIONS = new Set(["workers", "registry", "queues"]);

function isWorkforceComplianceSection(section: string): boolean {
  return WORKFORCE_SECTIONS.has(section);
}

/** Training → Compliance: matrix dashboard + workforce credentials hub (no top-level section tabs). */
export function TrainingComplianceShell({
  section,
  panel: panelQuery,
}: {
  section: string;
  panel?: string | null;
}) {
  const { session } = usePulseAuth();
  const allowed = canViewAnyTrainingCompliance(session);
  const fallback = firstAllowedTrainingComplianceSection(session);

  const activeSection: TrainingComplianceSection | null = useMemo(() => {
    if (!allowed) return null;
    if (isTrainingComplianceSection(section) && canViewTrainingComplianceSection(session, section)) {
      return section;
    }
    return fallback;
  }, [allowed, section, session, fallback]);

  const workforcePanel: WorkforceQualificationPanel = useMemo(() => {
    if (section === "workers") return workforcePanelFromSearchParams(panelQuery);
    if (isWorkforceComplianceSection(section)) return workforcePanelFromComplianceSection(section);
    return "people";
  }, [section, panelQuery]);

  if (!allowed) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className={uiPageTitle}>Compliance</h2>
        </header>
        <p className={uiCalloutWarning}>
          Compliance is available to company administrators, management, and supervisors. Your personal learning and
          completion status are on My Learning.
        </p>
        <Link href={TRAINING_ROUTES.learningMyLearning} className={cn("text-sm", uiTextLink)}>
          Go to My Learning →
        </Link>
      </div>
    );
  }

  const canViewActive = activeSection != null && canViewTrainingComplianceSection(session, activeSection);
  const showMatrix = canViewActive && activeSection === "matrix";
  const showWorkforce = canViewActive && activeSection != null && isWorkforceComplianceSection(activeSection);

  return (
    <WorkforceQualificationsProvider>
      <div className={uiPageStack}>
        {showMatrix ? (
          <>
            <header className="sr-only">
              <h2 className={uiPageTitle}>Compliance</h2>
              <p className={uiPageDescription}>Workforce training matrix and readiness.</p>
            </header>
            <WorkforceComplianceView />
          </>
        ) : null}

        {showWorkforce ? <WorkforceQualificationHub panel={workforcePanel} /> : null}

        {!canViewActive ? (
          <>
            <header className="space-y-1">
              <h2 className={uiPageTitle}>Compliance</h2>
            </header>
            <p className={uiCalloutWarning}>You do not have access to this view.</p>
            {fallback ? (
              <Link
                href={
                  fallback === "matrix"
                    ? TRAINING_ROUTES.complianceMatrix
                    : TRAINING_ROUTES.complianceWorkers
                }
                className={cn("text-sm", uiTextLink)}
              >
                Go to {fallback === "matrix" ? "Training matrix" : "Workforce"}
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </WorkforceQualificationsProvider>
  );
}
