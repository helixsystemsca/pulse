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
import { ModuleSettingsProvider } from "@/providers/ModuleSettingsProvider";
import { ProximityPromptHost } from "./ProximityPromptHost";
import { AppLayoutFooter } from "./AppLayoutFooter";
import { PulseThemedBackground } from "./PulseThemedBackground";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
  /** Applied to the inner `MainContentWidth` wrapper (width, padding, flex). */
  mainContentClassName?: string;
  /** When false, children render without the unified page card (login, invite, etc.). */
  pageShell?: boolean;
};

export function AppLayout({
  children,
  mainClassName = "",
  mainContentClassName = "",
  pageShell = true,
}: AppLayoutProps) {
  return (
    <div className="relative min-h-screen">
      <PulseThemedBackground />
      <OnboardingProvider>
        <ModuleSettingsProvider>
        <InactivitySessionGuard />
        <ServerTimeSync />
        <ProximityPromptHost />
        <div data-pulse-app-shell className="flex min-h-screen min-w-0 flex-col">
          <AppSideNav />
          <AppNavbar />
          <ImpersonationBanner />
          <AppMain className={mainClassName}>
            <MainContentWidth className={mainContentClassName}>
              {pageShell ? <PageShell>{children}</PageShell> : children}
            </MainContentWidth>
            <OnboardingChrome />
          </AppMain>
          <AppLayoutFooter />
        </div>
        </ModuleSettingsProvider>
      </OnboardingProvider>
    </div>
  );
}
