/**
 * Matrix slot visibility helpers (mirrors backend ``matrix_slot_policy``).
 * Warnings only — does not change authorization.
 */
import { PERMISSION_MATRIX_ROLE_LABEL, type PermissionMatrixRoleSlot } from "@/config/platform/permission-matrix";
import type { WorkerDetail, WorkerRow } from "@/lib/workersService";

export type MatrixSlotSource =
  | "explicit_matrix_slot"
  | "jwt_role"
  | "job_title_inference"
  | "department_default"
  | "fallback_default"
  | "explicit_required_policy";

export type MatrixSlotSourceKind = "explicit" | "inferred" | "fallback" | "policy";

const ELEVATED_TITLE_KEYWORDS = [
  "coordinator",
  "coordination",
  "supervisor",
  "manager",
  "director",
  "lead",
  "head of",
  "administrator",
  "admin",
] as const;

const SOURCE_KIND: Record<MatrixSlotSource, MatrixSlotSourceKind> = {
  explicit_matrix_slot: "explicit",
  jwt_role: "inferred",
  job_title_inference: "inferred",
  department_default: "inferred",
  fallback_default: "fallback",
  explicit_required_policy: "policy",
};

export function matrixSlotSourceKind(source: string | null | undefined): MatrixSlotSourceKind {
  if (!source) return "fallback";
  return SOURCE_KIND[source as MatrixSlotSource] ?? "inferred";
}

export function formatSlotSourceLabel(source: string | null | undefined): string {
  const labels: Record<string, string> = {
    explicit_matrix_slot: "Explicit",
    jwt_role: "Inferred (JWT role)",
    job_title_inference: "Inferred (job title)",
    department_default: "Department default",
    fallback_default: "Fallback",
    explicit_required_policy: "Policy enforced",
  };
  return labels[source ?? ""] ?? "Inferred";
}

export function formatMatrixSlotDisplay(
  slot: string | null | undefined,
  source: string | null | undefined,
): string {
  const slotKey = (slot ?? "team_member") as PermissionMatrixRoleSlot;
  const slotLabel =
    PERMISSION_MATRIX_ROLE_LABEL[slotKey] ?? String(slot).replace(/_/g, " ");
  const suffix = formatSlotSourceLabel(source);
  return `${slotLabel} (${suffix})`;
}

export type ElevatedWorkerInput = Pick<
  WorkerRow,
  "role" | "roles" | "job_title" | "department" | "department_slugs" | "matrix_slot" | "tenant_role_id"
> & {
  feature_allow_extra?: string[] | null;
  facility_tenant_admin?: boolean;
};

/** Heuristic: worker should have explicit matrix_slot (warnings only). */
export function detectLikelyElevatedWorker(worker: ElevatedWorkerInput): {
  likely: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const roles = worker.roles?.length ? worker.roles : worker.role ? [worker.role] : [];
  if (roles.includes("company_admin")) reasons.push("company_admin_role");
  if (roles.includes("manager")) reasons.push("jwt_manager");
  if (roles.includes("supervisor")) reasons.push("jwt_supervisor");
  if (roles.includes("lead")) reasons.push("jwt_lead");
  if (worker.facility_tenant_admin) reasons.push("facility_tenant_admin");

  const jt = (worker.job_title ?? "").toLowerCase();
  if (jt && ELEVATED_TITLE_KEYWORDS.some((k) => jt.includes(k))) {
    reasons.push("job_title_elevated_keyword");
  }
  if (worker.department_slugs && worker.department_slugs.length > 1) {
    reasons.push("multiple_department_slugs");
  }

  return { likely: reasons.length > 0, reasons };
}

export function isMatrixSlotInferred(row: Pick<WorkerRow, "matrix_slot" | "matrix_slot_inferred">): boolean {
  if (row.matrix_slot_inferred != null) return row.matrix_slot_inferred;
  return !row.matrix_slot?.trim();
}

export function shouldShowInferredAccessWarning(
  worker: ElevatedWorkerInput & Pick<WorkerRow, "matrix_slot_inferred" | "department">,
): boolean {
  const dept = worker.department?.trim() || worker.department_slugs?.[0];
  if (!dept) return false;
  if (!isMatrixSlotInferred(worker)) return false;
  const { likely } = detectLikelyElevatedWorker(worker);
  return likely;
}

export function inferredAccessBannerMessage(recommended?: string | null): string {
  const rec = recommended ? ` Recommended slot: ${recommended}.` : "";
  return `This worker is using inferred access rules. Explicit matrix_slot assignment is strongly recommended.${rec}`;
}

export function isPolicySuppressedSlot(source: string | null | undefined): boolean {
  return source === "explicit_required_policy";
}

export function isFallbackTeamMember(
  source: string | null | undefined,
  resolvedSlot: string | null | undefined,
): boolean {
  return source === "fallback_default" && (resolvedSlot ?? "team_member") === "team_member";
}
