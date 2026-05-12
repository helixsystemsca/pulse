import type { MatrixAdminOverride } from "@/lib/training/types";

/**
 * Cycles server-stored override (company admin matrix):
 * default → complete → not complete → not applicable → default.
 */
export function nextMatrixAdminOverride(
  current: MatrixAdminOverride | null | undefined,
): MatrixAdminOverride | null {
  if (current == null) return "force_complete";
  if (current === "force_complete") return "force_incomplete";
  if (current === "force_incomplete") return "force_na";
  return null;
}
