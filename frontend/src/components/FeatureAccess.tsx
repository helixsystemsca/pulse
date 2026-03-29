"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export type MeResponse = {
  id: string;
  email: string;
  tenant_id: string;
  role: string;
  full_name: string | null;
  enabled_features: string[];
};

export const FEATURE_LABELS: Record<string, string> = {
  tool_tracking: "Tool tracking",
  inventory: "Inventory",
  maintenance: "Maintenance",
  jobs: "Jobs",
  notifications: "Notifications",
  analytics: "Analytics",
};

type Ctx = {
  enabled: Set<string>;
  loaded: boolean;
  refresh: () => Promise<void>;
  has: (key: string) => boolean;
};

const FeatureAccessContext = createContext<Ctx | null>(null);

export function FeatureAccessProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const me = await apiFetch<MeResponse>("/api/v1/auth/me");
    setEnabled(new Set(me.enabled_features));
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setLoaded(true));
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener("oi-features-updated", onUpdate);
    return () => window.removeEventListener("oi-features-updated", onUpdate);
  }, [refresh]);

  const has = useCallback((key: string) => enabled.has(key), [enabled]);

  const value = useMemo(
    () => ({ enabled, loaded, refresh, has }),
    [enabled, loaded, refresh, has],
  );

  return <FeatureAccessContext.Provider value={value}>{children}</FeatureAccessContext.Provider>;
}

export function useFeatureAccess() {
  const ctx = useContext(FeatureAccessContext);
  if (!ctx) {
    throw new Error("useFeatureAccess must be used inside FeatureAccessProvider");
  }
  return ctx;
}
