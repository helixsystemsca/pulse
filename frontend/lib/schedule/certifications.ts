import type { Shift, Worker } from "./types";

/** Built-in certification codes with human-readable labels (extend with pass-through for custom tags). */
export const CERT_CODE_LABELS: Readonly<Record<string, string>> = {
  RO: "Refrigeration Operator",
  P1: "Pool Operator Level 1",
  P2: "Pool Operator Level 2",
  FA: "First Aid",
};

export function certificationLabel(code: string): string {
  const c = code.trim();
  return CERT_CODE_LABELS[c] ?? c;
}

export function formatCertCodesShort(codes: string[]): string {
  return codes.filter(Boolean).join(", ");
}

export function formatCertCodesWithLabels(codes: string[]): string {
  return codes.filter(Boolean).map(certificationLabel).join("; ");
}

/** Compact schedule chip / HTML title — single line segments separated by ` | `. */
export function scheduleShiftHoverSummary(
  shift: Shift,
  worker: Worker | null | undefined,
  conflicts: Array<{ label: string; type?: string }>,
): string {
  const segments: string[] = [];
  const req = shift.required_certifications?.filter(Boolean) ?? [];
  if (req.length) {
    const human = formatCertCodesWithLabels(req);
    if (shift.accepts_any_certification === true) {
      segments.push(`Required (any of): ${formatCertCodesShort(req)} — ${human}`);
    } else {
      segments.push(`Required (all): ${formatCertCodesShort(req)} — ${human}`);
    }
  }
  if (worker) {
    const wc = worker.certifications?.filter(Boolean) ?? [];
    segments.push(
      wc.length ? `Worker certifications: ${formatCertCodesShort(wc)}` : "Worker certifications: none on file",
    );
  } else {
    segments.push("Worker: unassigned");
  }
  const certIssues = conflicts.filter((c) => c.type === "certification");
  if (certIssues.length) {
    segments.push(`Certification: ${certIssues.map((c) => c.label).join(" · ")}`);
  }
  const other = conflicts.filter((c) => c.type !== "certification");
  if (other.length) {
    segments.push(`Other checks: ${other.map((c) => c.label).join(" · ")}`);
  }
  return segments.join(" | ");
}

export function shiftHasCertificationFlag(
  conflicts: Array<{ type?: string }>,
): boolean {
  return conflicts.some((c) => c.type === "certification");
}
