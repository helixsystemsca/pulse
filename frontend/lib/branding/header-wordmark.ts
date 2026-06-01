import type { CompanySummary } from "@/lib/pulse-session";

/** Shown in the app chrome when the tenant has not set a custom header wordmark. */
export const DEFAULT_APP_HEADER_WORDMARK = "HELIX";

export function resolveAppHeaderWordmark(company?: CompanySummary | null): string {
  const raw = company?.header_wordmark?.trim();
  if (raw) return raw;
  return DEFAULT_APP_HEADER_WORDMARK;
}
