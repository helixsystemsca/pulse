"use client";

import { useEffect, useState } from "react";
import { resolveAuthBrand, type AuthBrand } from "@/lib/branding/auth-brand";

/** Client hostname after mount — avoids SSR/hydration mismatch on marketing vs Vernon hosts. */
export function useClientHostname(): string | null {
  const [hostname, setHostname] = useState<string | null>(null);
  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);
  return hostname;
}

export function useAuthBrand(override?: AuthBrand | null): AuthBrand {
  const hostname = useClientHostname();
  if (override) return override;
  return resolveAuthBrand(hostname);
}
