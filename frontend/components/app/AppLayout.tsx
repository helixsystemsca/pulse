/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { AppMain } from "./AppMain";
import { InactivitySessionGuard } from "./InactivitySessionGuard";
import { ServerTimeSync } from "./ServerTimeSync";
import { MainContentWidth } from "./MainContentWidth";
import { PageShell } from "./PageShell";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { GuidedTourProvider } from "@/components/onboarding/CoreGuidedTour";
import { ModuleSettingsProvider } from "@/providers/ModuleSettingsProvider";
import { ProximityPromptHost } from "./ProximityPromptHost";
import { AppLayoutFooter } from "./AppLayoutFooter";
import { PulseThemedBackground } from "./PulseThemedBackground";
import { GamificationProvider } from "@/components/gamification/GamificationProvider";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
  /** Applied to the inner `MainContentWidth` wrapper (width, padding, flex). */
  mainContentClassName?: string;
  /** When false, children render without the unified page card (login, invite, etc.). */
  pageShell?: boolean;
  /** When false, hides navbar/sidebar/footer chrome (kiosk / external display pages). */
  chrome?: boolean;
};

export function AppLayout({
  children,
  mainClassName = "",
  mainContentClassName = "",
  pageShell = true,
  chrome = true,
}: AppLayoutProps) {
  return (
    <div className="relative min-h-screen">
      <PulseThemedBackground />
      <GuidedTourProvider>
      <OnboardingProvider>
        <ModuleSettingsProvider>
        <GamificationProvider>
        <InactivitySessionGuard />
        <ServerTimeSync />
        <ProximityPromptHost />
        <div data-pulse-app-shell className="flex min-h-screen min-w-0 flex-col">
          {chrome ? <AppNavbar /> : null}
          {chrome ? <ImpersonationBanner /> : null}
          <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
            {chrome ? <AppSideNav /> : null}
            <AppMain className={mainClassName} reserveRail={false}>
              <MainContentWidth className={mainContentClassName}>
                {pageShell ? <PageShell>{children}</PageShell> : children}
              </MainContentWidth>
              <OnboardingChrome />
            </AppMain>
          </div>
          {chrome ? <AppLayoutFooter /> : null}
        </div>
        </GamificationProvider>
        </ModuleSettingsProvider>
      </OnboardingProvider>
      </GuidedTourProvider>
    </div>
  );
}
