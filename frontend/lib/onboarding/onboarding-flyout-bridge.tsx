"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { NavDomain } from "@/config/platform/nav-domains";

type OnboardingFlyoutBridgeValue = {
  tourFlyoutDomain: NavDomain | null;
  setTourFlyoutDomain: (domain: NavDomain | null) => void;
  isTourActive: boolean;
  setTourActive: (active: boolean) => void;
};

const OnboardingFlyoutBridgeContext = createContext<OnboardingFlyoutBridgeValue | null>(null);

export function OnboardingFlyoutBridgeProvider({ children }: { children: ReactNode }) {
  const [tourFlyoutDomain, setTourFlyoutDomain] = useState<NavDomain | null>(null);
  const [isTourActive, setTourActive] = useState(false);

  const value = useMemo(
    () => ({
      tourFlyoutDomain,
      setTourFlyoutDomain,
      isTourActive,
      setTourActive,
    }),
    [tourFlyoutDomain, isTourActive],
  );

  return <OnboardingFlyoutBridgeContext.Provider value={value}>{children}</OnboardingFlyoutBridgeContext.Provider>;
}

export function useOnboardingFlyoutBridge(): OnboardingFlyoutBridgeValue | null {
  return useContext(OnboardingFlyoutBridgeContext);
}
