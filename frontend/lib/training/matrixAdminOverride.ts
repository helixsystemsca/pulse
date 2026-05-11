import type { MatrixAdminOverride } from "@/lib/training/types";

/** Cycles server-stored override: none → force complete → force incomplete → none. */
export function nextMatrixAdminOverride(
  current: MatrixAdminOverride | null | undefined,
): MatrixAdminOverride | null {
  if (current == null) return "force_complete";
  if (current === "force_complete") return "force_incomplete";
  return null;
}
