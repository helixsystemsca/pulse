"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isApiMode } from "@/lib/api";
import { fetchOnboarding, type OnboardingState } from "@/lib/onboardingService";
import { PULSE_ONBOARDING_UPDATED_EVENT } from "@/lib/onboarding-events";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type Ctx = {
  state: OnboardingState | null;
  loading: boolean;
  /** Re-fetch from GET /onboarding */
  reload: () => Promise<void>;
  checklistExpanded: boolean;
  setChecklistExpanded: (v: boolean) => void;
  /** True when tenant user should see onboarding UI */
  active: boolean;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function useOnboarding() {
  const c = useContext(OnboardingContext);
  if (!c) throw new Error("useOnboarding must be used within OnboardingProvider");
  return c;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { authed, session } = usePulseAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklistExpanded, setChecklistExpanded] = useState(false);

  const tenantEligible =
    isApiMode() &&
    authed &&
    session?.company_id &&
    !(session.is_system_admin || session.role === "system_admin");

  const reload = useCallback(async () => {
    if (!tenantEligible) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = await fetchOnboarding();
      setState(s);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [tenantEligible]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onAuth = () => void reload();
    window.addEventListener("pulse-auth-change", onAuth);
    return () => window.removeEventListener("pulse-auth-change", onAuth);
  }, [reload]);

  useEffect(() => {
    const onRemote = () => void reload();
    window.addEventListener(PULSE_ONBOARDING_UPDATED_EVENT, onRemote);
    return () => window.removeEventListener(PULSE_ONBOARDING_UPDATED_EVENT, onRemote);
  }, [reload]);

  const active = Boolean(
    tenantEligible && state?.onboarding_enabled && !state?.onboarding_completed,
  );

  const value = useMemo(
    () => ({
      state,
      loading,
      reload,
      checklistExpanded,
      setChecklistExpanded,
      active,
    }),
    [state, loading, reload, checklistExpanded, active],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
