/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { AppMain } from "./AppMain";
import { InactivitySessionGuard } from "./InactivitySessionGuard";
import { ServerTimeSync } from "./ServerTimeSync";
import { MainContentWidth } from "./MainContentWidth";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { ProximityPromptHost } from "./ProximityPromptHost";
import { AppPoweredByFooter } from "./AppPoweredByFooter";
import { PulseThemedBackground } from "./PulseThemedBackground";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
  /** Applied to the inner `MainContentWidth` wrapper (width, padding, flex). */
  mainContentClassName?: string;
};

export function AppLayout({ children, mainClassName = "", mainContentClassName = "" }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen">
      <PulseThemedBackground />
      <OnboardingProvider>
        <InactivitySessionGuard />
        <ServerTimeSync />
        <ProximityPromptHost />
        <AppSideNav />
        <div className="flex min-h-screen min-w-0 flex-col">
          <AppNavbar />
          <AppMain className={mainClassName}>
            <MainContentWidth className={mainContentClassName}>{children}</MainContentWidth>
            <OnboardingChrome />
          </AppMain>
          <AppPoweredByFooter />
        </div>
      </OnboardingProvider>
    </div>
  );
}
