/**
 * Matrix slot display helpers — operational labels separate from auth source.
 */
import {
  DEPARTMENT_BASELINE_SLOTS,
  PERMISSION_MATRIX_ROLE_LABEL,
  UNRESOLVED_MATRIX_SLOT,
  type PermissionMatrixDepartment,
  type PermissionMatrixRoleSlot,
} from "@/config/platform/permission-matrix";
import type { WorkerRow } from "@/lib/workersService";

export type MatrixSlotSource =
  | "explicit_matrix_slot"
  | "jwt_role"
  | "job_title_inference"
  | "department_baseline"
  | "department_default"
  | "unresolved"
  | "fallback_default"
  | "explicit_required_policy";

export type MatrixSlotSourceKind = "explicit" | "inferred" | "baseline" | "unresolved" | "policy";

const SOURCE_KIND: Record<string, MatrixSlotSourceKind> = {
  explicit_matrix_slot: "explicit",
  jwt_role: "inferred",
  job_title_inference: "inferred",
  department_baseline: "baseline",
  department_default: "baseline",
  unresolved: "unresolved",
  fallback_default: "unresolved",
  explicit_required_policy: "policy",
};

const SOURCE_LABEL: Record<string, string> = {
  explicit_matrix_slot: "Explicit",
  jwt_role: "Inferred",
  job_title_inference: "Inferred",
  department_baseline: "Department default",
  department_default: "Department default",
  unresolved: "Unresolved",
  fallback_default: "Unresolved",
  explicit_required_policy: "Policy hold",
};

export function matrixSlotSourceKind(source: string | null | undefined): MatrixSlotSourceKind {
  if (!source) return "baseline";
  return SOURCE_KIND[source] ?? "inferred";
}

export function formatSlotSourceLabel(source: string | null | undefined): string {
  return SOURCE_LABEL[source ?? ""] ?? "Inferred";
}

export function operationalMatrixSlotLabel(
  slot: string | null | undefined,
  department?: string | null,
): string {
  if (!slot || slot === UNRESOLVED_MATRIX_SLOT) return "Unresolved";
  const key = slot as PermissionMatrixRoleSlot;
  if (key in PERMISSION_MATRIX_ROLE_LABEL) {
    return PERMISSION_MATRIX_ROLE_LABEL[key];
  }
  const dept = (department ?? "").trim().toLowerCase() as PermissionMatrixDepartment;
  const baseline = DEPARTMENT_BASELINE_SLOTS[dept];
  if (baseline && slot === baseline) {
    return PERMISSION_MATRIX_ROLE_LABEL[baseline];
  }
  return String(slot).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Primary roster label — operational identity only. */
export function formatMatrixSlotOperationalLabel(
  slot: string | null | undefined,
  department?: string | null,
): string {
  return operationalMatrixSlotLabel(slot, department);
}

/** @deprecated Use formatMatrixSlotOperationalLabel + formatSlotSourceLabel */
export function formatMatrixSlotDisplay(
  slot: string | null | undefined,
  _source?: string | null,
  department?: string | null,
): string {
  return formatMatrixSlotOperationalLabel(slot, department);
}

export function isMatrixSlotInferred(row: Pick<WorkerRow, "matrix_slot" | "matrix_slot_inferred">): boolean {
  if (row.matrix_slot_inferred != null) return row.matrix_slot_inferred;
  return !row.matrix_slot?.trim();
}

export function isUnresolvedMatrixSlot(
  source: string | null | undefined,
  resolvedSlot?: string | null,
): boolean {
  return (
    source === "unresolved" ||
    source === "fallback_default" ||
    resolvedSlot === UNRESOLVED_MATRIX_SLOT
  );
}

export function isPolicySuppressedSlot(source: string | null | undefined): boolean {
  return source === "explicit_required_policy";
}

/** @deprecated */
export function isFallbackTeamMember(
  source: string | null | undefined,
  resolvedSlot: string | null | undefined,
): boolean {
  return isUnresolvedMatrixSlot(source, resolvedSlot);
}

/** @deprecated */
export function detectLikelyElevatedWorker(): { likely: boolean; reasons: string[] } {
  return { likely: false, reasons: [] };
}

/** @deprecated */
export function shouldShowInferredAccessWarning(): boolean {
  return false;
}

/** @deprecated */
export function inferredAccessBannerMessage(): string {
  return "";
}
