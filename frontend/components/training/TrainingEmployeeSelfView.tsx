"use client";

import { useEffect, useMemo, useState } from "react";
import { MyLearningDashboard } from "@/components/training/my-learning/MyLearningDashboard";
import { isApiMode } from "@/lib/api";
import { complianceAlertsForEmployee } from "@/lib/training/complianceAlerts";
import { buildMyLearningDashboard } from "@/lib/training/myLearningDashboard";
import { MOCK_TRAINING_PROGRAMS } from "@/lib/training/mockData";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import {
  acknowledgementsFromWorkerTraining,
  fetchWorkerTraining,
  mapApiAssignments,
  mapApiPrograms,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";
import { trainingAcknowledgementsForPersona, trainingAssignmentsForPersona } from "@/lib/training/selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingProgram } from "@/lib/training/types";

const TIER_SORT: TrainingProgram["tier"][] = ["mandatory", "high_risk", "general"];

export function TrainingEmployeeSelfView() {
  const api = isApiMode();
  const session = readSession();
  const workerId = session?.sub ?? "";
  const displayName = (session?.full_name ?? session?.email ?? "Your profile").trim();
  const jobTitle = session?.job_title ?? null;

  const [bundle, setBundle] = useState<WorkerTrainingApiResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !workerId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const data = await fetchWorkerTraining(workerId);
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
  }, [api, workerId]);

  const useLive = Boolean(api && bundle && !loadErr);

  const programs = useMemo(() => {
    const raw = useLive
      ? mapApiPrograms(bundle!.programs).filter((p) => p.active)
      : MOCK_TRAINING_PROGRAMS.filter((p) => p.active);
    return [...raw].sort((a, b) => {
      const ti = TIER_SORT.indexOf(a.tier);
      const tj = TIER_SORT.indexOf(b.tier);
      if (ti !== tj) return ti - tj;
      return a.title.localeCompare(b.title);
    });
  }, [useLive, bundle]);

  const assignments: TrainingAssignment[] = useLive
    ? mapApiAssignments(bundle!.assignments)
    : trainingAssignmentsForPersona(workerId || "demo-worker");

  const acks: TrainingAcknowledgement[] = useLive
    ? acknowledgementsFromWorkerTraining(workerId, bundle!)
    : trainingAcknowledgementsForPersona(workerId || "demo-worker");

  const trustServer = useLive;

  const alerts = useMemo(
    () =>
      workerId
        ? complianceAlertsForEmployee(workerId, programs, assignments, acks, trustServer)
        : [],
    [workerId, programs, assignments, acks, trustServer],
  );

  const dashboardModel = useMemo(
    () =>
      workerId
        ? buildMyLearningDashboard({
            employeeId: workerId,
            programs,
            assignments,
            acknowledgements: acks,
            alerts,
            trustAssignmentStatus: trustServer,
          })
        : null,
    [workerId, programs, assignments, acks, alerts, trustServer],
  );

  if (!workerId) {
    return (
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-5 text-sm text-ds-muted">
        Sign in to view your training assignments and acknowledgements.
      </div>
    );
  }

  if (!dashboardModel) return null;

  return (
    <MyLearningDashboard
      displayName={displayName}
      jobTitle={jobTitle}
      loading={loading}
      loadError={loadErr}
      model={dashboardModel}
    />
  );
}
