"use client";

import { usePulseAuth } from "@/hooks/usePulseAuth";

/** Stable tenant company id for API calls — avoids `readSession()` object identity in effect deps. */
export function useSessionCompanyId(): string | null {
  const { session } = usePulseAuth();
  return session?.company_id ?? null;
}
