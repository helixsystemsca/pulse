"use client";

import Link from "next/link";
import { BookOpen, ShieldCheck } from "lucide-react";
import { readSession } from "@/lib/pulse-session";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
import { TrainingLearningLeadership } from "@/components/training/TrainingLearningLeadership";

export function TrainingLearningApp() {
  const session = readSession();
  const leadership = trainingTeamMatrixAccess(session);

  if (!leadership) {
    return <TrainingEmployeeSelfView />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-ds-border bg-ds-card px-4 py-3">
        <div className="flex gap-3">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ds-foreground">Assigned learning</p>
            <p className="mt-0.5 max-w-2xl text-sm text-ds-muted">
              Onboarding, procedure assignments, and completion progress. Workforce readiness and the training matrix
              live under Compliance.
            </p>
          </div>
        </div>
        <Link
          href="/standards/compliance"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-ds-border bg-ds-muted/20 px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-muted/40"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Open compliance dashboard
        </Link>
      </div>
      <TrainingLearningLeadership />
    </div>
  );
}
