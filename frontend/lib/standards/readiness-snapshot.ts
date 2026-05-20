/**
 * Workforce readiness snapshot — consumed by scheduler, projects, and staffing tools.
 * Built from compliance matrix + structured certifications (presentation/integration layer).
 */
import type { TrainingAssignmentStatus } from "@/lib/training/types";

export type ReadinessCompetencyState = "qualified" | "in_progress" | "expired" | "not_assigned" | "waived";

export type WorkerCertificationReadiness = {
  registryCode: string;
  label: string;
  expiryDate: string | null;
  competencyState: ReadinessCompetencyState;
  verificationStatus: "verified" | "pending" | "rejected" | "unverified";
};

export type WorkerProcedureReadiness = {
  programId: string;
  title: string;
  status: TrainingAssignmentStatus;
  expiryDate: string | null;
  tier: string;
};

/** Single worker readiness envelope for shift/project recommendation hooks. */
export type WorkerReadinessSnapshot = {
  workerId: string;
  displayName: string;
  department: string;
  /** 0–100 — procedure-backed training completion for assigned programs */
  trainingCompletionPct: number;
  /** 0–100 — includes expiring-soon in denominator per compliance dashboard rules */
  readinessPct: number;
  certifications: WorkerCertificationReadiness[];
  procedures: WorkerProcedureReadiness[];
  expiringWithinDays: number;
  updatedAt: string;
};

export type WorkforceReadinessSnapshot = {
  companyId: string | null;
  workers: WorkerReadinessSnapshot[];
  generatedAt: string;
};

/** Placeholder builder — callers pass pre-aggregated rows until batch API exists. */
export function buildWorkforceReadinessSnapshot(input: {
  companyId: string | null;
  workers: WorkerReadinessSnapshot[];
}): WorkforceReadinessSnapshot {
  return {
    companyId: input.companyId,
    workers: input.workers,
    generatedAt: new Date().toISOString(),
  };
}
