"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BookOpen, ClipboardList, History } from "lucide-react";
import { ProceduresApp } from "@/components/procedures/ProceduresApp";
import { ProcedureAcknowledgmentsArchiveClient } from "@/components/standards/ProcedureAcknowledgmentsArchiveClient";
import { MyProceduresAssignmentsView } from "@/components/training/domain/MyProceduresAssignmentsView";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { cn } from "@/lib/cn";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { TRAINING_ROUTES, trainingLearningHref } from "@/lib/training/routes";
import {
  canViewTrainingLearningSection,
  firstAllowedTrainingLearningSection,
  isTrainingLearningSection,
  type TrainingLearningSection,
} from "@/lib/training/training-domain-access";

const TABS: { id: TrainingLearningSection; label: string; icon: typeof ClipboardList }[] = [
  { id: "assignments", label: "My assignments", icon: ClipboardList },
  { id: "procedures", label: "Procedure library", icon: BookOpen },
  { id: "acknowledgments", label: "Acknowledgment archive", icon: History },
];

export function TrainingLearningShell({ section }: { section: string }) {
  const { session } = usePulseAuth();
  const leadership = trainingTeamMatrixAccess(session);
  const activeSection: TrainingLearningSection = isTrainingLearningSection(section)
    ? section
    : firstAllowedTrainingLearningSection(session);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => canViewTrainingLearningSection(session, t.id)),
    [session],
  );

  const canViewActive = canViewTrainingLearningSection(session, activeSection);
  const fallback = firstAllowedTrainingLearningSection(session);

  if (!leadership && activeSection === "assignments") {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Learning</h2>
          <p className="max-w-2xl text-sm text-ds-muted">
            Complete required procedures — acknowledge, upload proof, and submit for review. Compliance updates when
            supervisors verify your work.
          </p>
        </header>
        <TrainingEmployeeSelfView />
        <MyProceduresAssignmentsView embedded />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Learning</h2>
        <p className="max-w-3xl text-sm text-ds-muted">
          Workflow layer for procedure completion — assignments, acknowledgements, uploads, and submissions. Procedure
          content is managed in the library; Compliance reflects verified qualification state.
        </p>
      </header>

      {visibleTabs.length > 1 ? (
        <nav className="flex flex-wrap gap-1 border-b border-ds-border pb-2" aria-label="Learning sections">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const href = trainingLearningHref(t.id);
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
      ) : null}

      {!canViewActive ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          You do not have access to this section.
        </p>
      ) : null}

      {canViewActive && activeSection === "assignments" ? (
        <div className="space-y-8">
          <MyProceduresAssignmentsView embedded />
          {leadership ? (
            <section className="rounded-lg border border-dashed border-ds-border bg-ds-muted/10 p-4 text-sm text-ds-muted">
              <p>
                Team matrix previews live under{" "}
                <Link href={TRAINING_ROUTES.complianceMatrix} className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
                  Compliance → Matrix
                </Link>
                .
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
      {canViewActive && activeSection === "procedures" ? <ProceduresApp /> : null}
      {canViewActive && activeSection === "acknowledgments" ? <ProcedureAcknowledgmentsArchiveClient /> : null}

      {!canViewActive && fallback !== activeSection ? (
        <Link
          href={trainingLearningHref(fallback)}
          className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300"
        >
          Go to {TABS.find((t) => t.id === fallback)?.label ?? "assignments"}
        </Link>
      ) : null}
    </div>
  );
}
