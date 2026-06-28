"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BookOpen, Brain, ClipboardList, GitBranch, GraduationCap, History, Layers, Send, UserPlus } from "lucide-react";
import { ProceduresApp } from "@/components/procedures/ProceduresApp";
import { ProcedureAcknowledgmentsArchiveClient } from "@/components/standards/ProcedureAcknowledgmentsArchiveClient";
import { CourseCatalog } from "@/components/training/courses/CourseCatalog";
import { LearningPathsPanel } from "@/components/training/paths/LearningPathsPanel";
import { FlashcardStudySession } from "@/components/training/study/FlashcardStudySession";
import { MyProceduresAssignmentsView } from "@/components/training/domain/MyProceduresAssignmentsView";
import { LearningAssignPanel } from "@/components/training/domain/LearningAssignPanel";
import { LearningBundleManager } from "@/components/training/domain/LearningBundleManager";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
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
import { TRAINING_ROUTES, trainingLearningHref } from "@/lib/training/routes";
import {
  canAssignLearning,
  canManageLearningBundles,
  canViewTrainingLearningSection,
  firstAllowedTrainingLearningSection,
  isTrainingLearningSection,
  normalizeLearningSection,
  type TrainingLearningSection,
} from "@/lib/training/training-domain-access";

const TABS: { id: TrainingLearningSection; label: string; icon: typeof ClipboardList }[] = [
  { id: "my-learning", label: "My Learning", icon: ClipboardList },
  { id: "courses", label: "Courses", icon: GraduationCap },
  { id: "study", label: "Study", icon: Brain },
  { id: "paths", label: "Paths", icon: GitBranch },
  { id: "assign", label: "Assign", icon: Send },
  { id: "bundles", label: "Bundles", icon: Layers },
  { id: "library", label: "Procedure library", icon: BookOpen },
  { id: "archive", label: "Acknowledgment archive", icon: History },
];

export function TrainingLearningShell({ section }: { section: string }) {
  const { session } = usePulseAuth();
  const normalized = normalizeLearningSection(section);
  const activeSection: TrainingLearningSection = isTrainingLearningSection(normalized)
    ? (normalized as TrainingLearningSection)
    : firstAllowedTrainingLearningSection(session);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => canViewTrainingLearningSection(session, t.id)),
    [session],
  );

  const canViewActive = canViewTrainingLearningSection(session, activeSection);
  const fallback = firstAllowedTrainingLearningSection(session);
  const workerOnlyHub =
    !canAssignLearning(session) && !canManageLearningBundles(session);
  const workerPlatformSection =
    activeSection === "courses" || activeSection === "study" || activeSection === "paths";

  if (workerOnlyHub && activeSection === "my-learning") {
    return (
      <div className={uiPageStack}>
        <header className="space-y-1">
          <h2 className={uiPageTitle}>Learning</h2>
          <p className={cn(uiPageDescription, "max-w-2xl")}>
            Assigned learning — read, acknowledge, upload proof, and submit for review. Compliance updates when
            supervisors verify your work.
          </p>
        </header>
        <TrainingEmployeeSelfView />
        <MyProceduresAssignmentsView embedded />
      </div>
    );
  }

  if (workerOnlyHub && workerPlatformSection) {
    return (
      <div className={uiPageStack}>
        <header className="space-y-1">
          <h2 className={uiPageTitle}>Learning</h2>
          <p className={cn(uiPageDescription, "max-w-2xl")}>
            Structured courses, flashcard study, and learning paths.
          </p>
        </header>
        {visibleTabs.length > 1 ? (
          <nav className={uiTabNav} aria-label="Learning sections">
            {visibleTabs
              .filter((t) => ["my-learning", "courses", "study", "paths"].includes(t.id))
              .map((t) => {
                const Icon = t.icon;
                const href = trainingLearningHref(t.id);
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
        ) : null}
        {activeSection === "courses" ? <CourseCatalog /> : null}
        {activeSection === "study" ? <FlashcardStudySession /> : null}
        {activeSection === "paths" ? <LearningPathsPanel /> : null}
      </div>
    );
  }

  return (
    <div className={uiPageStack}>
      <header className="space-y-1">
        <h2 className={uiPageTitle}>Learning</h2>
        <p className={uiPageDescription}>
          Worker completion workflow — My Learning, assignments, acknowledgements, and submissions. Procedure content
          lives in the library; Compliance reflects verified qualification state.
        </p>
      </header>

      {visibleTabs.length > 1 ? (
        <nav className={uiTabNav} aria-label="Learning sections">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const href = trainingLearningHref(t.id);
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
      ) : null}

      {!canViewActive ? (
        <div className={cn(uiCalloutWarning, "space-y-3")}>
          <p>
            {activeSection === "archive"
              ? "The acknowledgment archive is available to company administrators, management, and supervisors."
              : "You do not have access to this section."}
          </p>
          {activeSection === "archive" ? (
            <Link
              href={TRAINING_ROUTES.learningMyLearning}
              className={uiTextLink}
            >
              Go to My Learning →
            </Link>
          ) : null}
        </div>
      ) : null}

      {canViewActive && activeSection === "my-learning" ? (
        <div className="space-y-8">
          <TrainingEmployeeSelfView />
          <MyProceduresAssignmentsView embedded />
        </div>
      ) : null}
      {canViewActive && activeSection === "assign" ? <LearningAssignPanel /> : null}
      {canViewActive && activeSection === "bundles" ? <LearningBundleManager /> : null}
      {canViewActive && activeSection === "courses" ? <CourseCatalog /> : null}
      {canViewActive && activeSection === "study" ? <FlashcardStudySession /> : null}
      {canViewActive && activeSection === "paths" ? <LearningPathsPanel /> : null}
      {canViewActive && activeSection === "library" ? <ProceduresApp /> : null}
      {canViewActive && activeSection === "archive" ? <ProcedureAcknowledgmentsArchiveClient /> : null}

      {!canViewActive && fallback !== activeSection ? (
        <Link
          href={trainingLearningHref(fallback)}
          className={cn("inline-flex items-center gap-2 text-sm", uiTextLink)}
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Go to {TABS.find((t) => t.id === fallback)?.label ?? "My Learning"}
        </Link>
      ) : null}

      {canViewActive && activeSection === "my-learning" ? (
        <section className="rounded-lg border border-dashed border-ds-border bg-ds-muted/10 p-4 text-sm text-ds-muted">
          <p>
            Team qualification state lives under{" "}
            <Link
              href={TRAINING_ROUTES.complianceMatrix}
              className="font-semibold text-teal-700 hover:underline dark:text-teal-300"
            >
              Compliance → Matrix
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}
