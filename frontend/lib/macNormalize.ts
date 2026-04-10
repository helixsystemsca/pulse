/** Normalize MAC for comparisons (same idea as backend: hex only, upper case). */
export function normalizeMacKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
}
