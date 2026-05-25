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
import {
  uiCalloutWarning,
  uiIconInTab,
  uiPageDescription,
  uiPageStack,
  uiPageTitle,
  uiTabLink,
  uiTabLinkActive,
  uiTabLinkIdle,
  uiTabNav,
  uiTextLink,
} from "@/styles/ui-classes";
import { TRAINING_ROUTES, trainingComplianceHref } from "@/lib/training/routes";
import {
  canViewAnyTrainingCompliance,
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

/** Training → Compliance: unified qualification engine (matrix-first). Leadership-only. */
export function TrainingComplianceShell({ section }: { section: string }) {
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

  const visibleTabs = useMemo(
    () => TABS.filter((t) => canViewTrainingComplianceSection(session, t.id)),
    [session],
  );

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

  return (
    <WorkforceQualificationsProvider>
      <div className={uiPageStack}>
        <header className="space-y-1">
          <h2 className={uiPageTitle}>Compliance</h2>
          <p className={uiPageDescription}>
            Authoritative workforce qualification state — matrix, registry, expirations, and readiness. Schedules and
            dashboards consume this data; workers complete items under Learning.
          </p>
        </header>

        <nav className={uiTabNav} aria-label="Compliance views">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const href = trainingComplianceHref(t.id);
            const isActive = activeSection === t.id;
            return (
              <Link
                key={t.id}
                href={href}
                className={cn(uiTabLink, isActive ? uiTabLinkActive : uiTabLinkIdle)}
              >
                <Icon className={uiIconInTab} aria-hidden />
                {t.label}
              </Link>
            );
          })}
        </nav>

        {!canViewActive ? (
          <p className={uiCalloutWarning}>You do not have access to this view.</p>
        ) : null}

        {canViewActive && activeSection === "matrix" ? <WorkforceComplianceView /> : null}
        {canViewActive && activeSection === "workers" ? <WorkersQualificationView /> : null}
        {canViewActive && activeSection === "registry" ? <CertificationsRegistryView /> : null}
        {canViewActive && activeSection === "queues" ? <ExpiringQualificationsView /> : null}

        {!canViewActive && fallback && fallback !== activeSection ? (
          <Link
            href={trainingComplianceHref(fallback)}
            className={cn("text-sm", uiTextLink)}
          >
            Go to {TABS.find((t) => t.id === fallback)?.label ?? "Matrix"}
          </Link>
        ) : null}
      </div>
    </WorkforceQualificationsProvider>
  );
}
