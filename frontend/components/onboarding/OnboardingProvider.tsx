"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isApiMode } from "@/lib/api";
import { fetchOnboarding, type OnboardingState } from "@/lib/onboardingService";
import { PULSE_ONBOARDING_UPDATED_EVENT } from "@/lib/onboarding-events";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

type Ctx = {
  state: OnboardingState | null;
  loading: boolean;
  reload: () => Promise<void>;
  checklistExpanded: boolean;
  setChecklistExpanded: (v: boolean) => void;
  active: boolean;
  /** Dismissible toast (step progress or completion). */
  toastMessage: string | null;
  dismissToast: () => void;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function useOnboarding() {
  const c = useContext(OnboardingContext);
  if (!c) throw new Error("useOnboarding must be used within OnboardingProvider");
  return c;
}

/** For components that may render outside the provider (e.g. optional chrome). */
export function useOnboardingOptional(): Ctx | null {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { authed, session } = usePulseAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const prevCompletionRef = useRef<Record<string, boolean> | null>(null);
  const prevCompletedFlagRef = useRef<boolean | null>(null);
  const hydratedRef = useRef(false);

  const dismissToast = useCallback(() => setToastMessage(null), []);

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
    hydratedRef.current = false;
    prevCompletionRef.current = null;
    prevCompletedFlagRef.current = null;
  }, [session?.sub]);

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

  useEffect(() => {
    if (!state?.steps?.length) return;

    const nowMap = Object.fromEntries(state.steps.map((s) => [s.key, s.completed]));

    if (!hydratedRef.current) {
      prevCompletionRef.current = nowMap;
      prevCompletedFlagRef.current = state.onboarding_completed;
      hydratedRef.current = true;
      return;
    }

    const prev = prevCompletionRef.current ?? {};
    const prevFlag = prevCompletedFlagRef.current;

    let justCompletedKey: string | null = null;
    for (const s of state.steps) {
      if (s.completed && prev[s.key] === false) {
        justCompletedKey = s.key;
        break;
      }
    }

    if (state.onboarding_completed && prevFlag === false) {
      setToastMessage("🎉 Setup complete — your system is ready");
      setChecklistExpanded(false);
    } else if (justCompletedKey && !state.onboarding_completed) {
      const row = state.steps.find((x) => x.key === justCompletedKey);
      const label = row?.label ?? justCompletedKey;
      setToastMessage(`✅ ${label} — ${state.completed_count}/${state.total_count} complete`);
    }

    prevCompletionRef.current = nowMap;
    prevCompletedFlagRef.current = state.onboarding_completed;
  }, [state]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  const active = Boolean(
    tenantEligible &&
      session &&
      sessionHasAnyRole(session, "company_admin") &&
      state?.onboarding_enabled &&
      !state?.onboarding_completed,
  );

  const value = useMemo(
    () => ({
      state,
      loading,
      reload,
      checklistExpanded,
      setChecklistExpanded,
      active,
      toastMessage,
      dismissToast,
    }),
    [state, loading, reload, checklistExpanded, active, toastMessage, dismissToast, session],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
