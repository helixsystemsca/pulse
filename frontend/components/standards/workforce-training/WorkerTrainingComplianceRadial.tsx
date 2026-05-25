"use client";

import { useEffect, useMemo, useState } from "react";
import { ComplianceRadial } from "@/components/dashboard/widgets/training/ComplianceRadial";
import { TC_COLORS } from "@/components/dashboard/widgets/training/training-compliance-visual";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { MOCK_TRAINING_PROGRAMS } from "@/lib/training/mockData";
import {
  acknowledgementsFromWorkerTraining,
  fetchWorkerTraining,
  mapApiAssignments,
  mapApiPrograms,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";
import {
  computeComplianceRadialSummary,
  trainingAcknowledgementsForPersona,
  trainingAssignmentsForPersona,
} from "@/lib/training/selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingEmployee, TrainingProgram } from "@/lib/training/types";

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ds-muted">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

export function WorkerTrainingComplianceRadial({
  employeeId,
  employeeName,
  department,
}: {
  employeeId: string;
  employeeName: string;
  department?: string | null;
}) {
  const api = isApiMode();
  const [bundle, setBundle] = useState<WorkerTrainingApiResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !employeeId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const data = await fetchWorkerTraining(employeeId);
        if (!cancelled) setBundle(data);
      } catch (e) {
        if (!cancelled) setLoadErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, employeeId]);

  const useLive = Boolean(api && bundle && !loadErr);

  const programs: TrainingProgram[] = useLive
    ? mapApiPrograms(bundle!.programs).filter((p) => p.active)
    : MOCK_TRAINING_PROGRAMS.filter((p) => p.active);
  const assignments: TrainingAssignment[] = useLive
    ? mapApiAssignments(bundle!.assignments)
    : trainingAssignmentsForPersona(employeeId);
  const acks: TrainingAcknowledgement[] = useLive
    ? acknowledgementsFromWorkerTraining(employeeId, bundle!)
    : trainingAcknowledgementsForPersona(employeeId);

  const employee: TrainingEmployee = useMemo(
    () => ({
      id: employeeId,
      display_name: employeeName,
      department: department ?? "",
    }),
    [employeeId, employeeName, department],
  );

  const summary = useMemo(
    () =>
      computeComplianceRadialSummary([employee], programs, assignments, acks, {
        trustAssignmentStatus: useLive,
      }),
    [employee, programs, assignments, acks, useLive],
  );

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-ds-border/70 bg-ds-secondary/25 px-4 py-5">
      {loading ? <p className="text-xs text-ds-muted">Loading routines compliance…</p> : null}
      {loadErr ? <p className="text-xs font-semibold text-ds-danger">Could not load training: {loadErr}</p> : null}
      <ComplianceRadial
        overallCompliancePercent={summary.overallCompliancePercent}
        completed={summary.completed}
        expiringSoon={summary.expiringSoon}
        missing={summary.missing}
        totalSlots={summary.totalSlots}
        size="md"
        mode="overall"
      />
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <LegendDot color={TC_COLORS.completed.to} label="Complete" />
        <LegendDot color={TC_COLORS.missing.to} label="Missing" />
        <LegendDot color={TC_COLORS.expiring.to} label="Expiring" />
      </div>
      <p className="max-w-sm text-center text-xs text-ds-muted">
        Routines-tier programs only. {!useLive ? "Demo snapshot for UI testing." : "Live assignments from your organization."}
      </p>
    </div>
  );
}
