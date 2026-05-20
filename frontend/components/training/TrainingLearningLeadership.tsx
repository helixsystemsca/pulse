"use client";

import { useEffect, useMemo, useState } from "react";
import { TrainingMatrixTable } from "@/components/training/TrainingMatrixTable";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import { fetchWorkerList } from "@/lib/workersService";
import { readProcedureComplianceConfig } from "@/lib/training/procedureComplianceConfig";
import { workersToTrainingEmployees, proceduresToTrainingPrograms } from "@/lib/training/liveCatalog";
import { generateDemoAssignmentsForMatrix } from "@/lib/training/generatedAssignments";
import { MOCK_TRAINING_PROGRAMS, MOCK_TRAINING_EMPLOYEES } from "@/lib/training/mockData";
import {
  fetchTrainingMatrix,
  mapApiAssignments,
  mapApiEmployees,
  mapApiPrograms,
} from "@/lib/trainingApi";
import { fetchProcedures } from "@/lib/cmmsApi";
import type { TrainingAssignment, TrainingEmployee, TrainingProgram } from "@/lib/training/types";

/**
 * Leadership learning view — assigned programs and progress (no compliance matrix).
 */
export function TrainingLearningLeadership() {
  const api = isApiMode();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [employees, setEmployees] = useState<TrainingEmployee[]>(MOCK_TRAINING_EMPLOYEES);
  const [programs, setPrograms] = useState<TrainingProgram[]>(MOCK_TRAINING_PROGRAMS.filter((p) => p.active));
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);

  useEffect(() => {
    if (!api) {
      const demo = generateDemoAssignmentsForMatrix(MOCK_TRAINING_EMPLOYEES, MOCK_TRAINING_PROGRAMS);
      setAssignments(demo.assignments);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const matrix = await fetchTrainingMatrix();
        if (cancelled) return;
        setEmployees(mapApiEmployees(matrix.employees));
        setPrograms(mapApiPrograms(matrix.programs).filter((p) => p.active));
        setAssignments(mapApiAssignments(matrix.assignments));
      } catch (e) {
        if (cancelled) return;
        try {
          const session = readSession();
          const [w, p] = await Promise.all([
            fetchWorkerList(session?.company_id ?? null, { include_inactive: false }),
            fetchProcedures(),
          ]);
          if (cancelled) return;
          const emps = workersToTrainingEmployees(w.items ?? []);
          const progs = proceduresToTrainingPrograms(p, readProcedureComplianceConfig()).filter((x) => x.active);
          const demo = generateDemoAssignmentsForMatrix(emps, progs);
          setEmployees(emps);
          setPrograms(progs);
          setAssignments(demo.assignments);
          setErr(parseClientApiError(e).message);
        } catch (inner) {
          if (!cancelled) setErr(parseClientApiError(inner).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const onboardingPrograms = useMemo(
    () => programs.filter((p) => p.onboarding_required || p.category.toLowerCase().includes("onboard")),
    [programs],
  );

  const inProgressCount = useMemo(
    () => assignments.filter((a) => ["pending", "in_progress", "acknowledged", "quiz_failed"].includes(a.status)).length,
    [assignments],
  );

  const learningPrograms = useMemo(
    () => programs.filter((p) => p.tier === "general" || p.onboarding_required).slice(0, 8),
    [programs],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Active programs</p>
          <p className="mt-1 text-2xl font-bold text-ds-foreground">{programs.length}</p>
        </div>
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Onboarding track</p>
          <p className="mt-1 text-2xl font-bold text-ds-foreground">{onboardingPrograms.length}</p>
        </div>
        <div className="rounded-xl border border-ds-border bg-ds-card px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">In progress</p>
          <p className="mt-1 text-2xl font-bold text-ds-foreground">{inProgressCount}</p>
        </div>
      </div>

      {loading ? <p className="text-sm text-ds-muted">Loading assignments…</p> : null}
      {err ? <p className="text-sm font-medium text-rose-600">Using fallback data: {err}</p> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Team learning progress</h3>
        <TrainingMatrixTable
          employees={employees.slice(0, 12)}
          programs={learningPrograms}
          assignments={assignments}
          acknowledgements={[]}
          trustAssignmentStatus={api}
        />
      </section>
    </div>
  );
}
