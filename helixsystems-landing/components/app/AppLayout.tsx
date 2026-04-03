/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { AppMain } from "./AppMain";
import { MainContentWidth } from "./MainContentWidth";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { ProximityPromptHost } from "./ProximityPromptHost";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
};

export function AppLayout({ children, mainClassName = "" }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen bg-white">
      <ProximityPromptHost />
      <AppSideNav />
      <div className="flex min-h-screen min-w-0 flex-col">
        <AppNavbar />
        <AppMain className={mainClassName}>
          <OnboardingProvider>
            <MainContentWidth>{children}</MainContentWidth>
            <OnboardingChrome />
          </OnboardingProvider>
        </AppMain>
      </div>
    </div>
  );
}
