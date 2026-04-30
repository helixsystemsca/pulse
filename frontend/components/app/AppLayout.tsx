/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { InactivitySessionGuard } from "./InactivitySessionGuard";
import { ServerTimeSync } from "./ServerTimeSync";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";
import { GuidedTourProvider } from "@/components/onboarding/CoreGuidedTour";
import { ModuleSettingsProvider } from "@/providers/ModuleSettingsProvider";
import { ProximityPromptHost } from "./ProximityPromptHost";
import { AppLayoutFooter } from "./AppLayoutFooter";
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-muted/30">
      <GuidedTourProvider>
      <OnboardingProvider>
        <ModuleSettingsProvider>
        <GamificationProvider>
        <InactivitySessionGuard />
        <ServerTimeSync />
        <ProximityPromptHost />
        <div data-pulse-app-shell className="flex h-full w-full flex-col overflow-hidden">
          {chrome ? (
            <header className="flex h-14 items-center border-b bg-background px-4">
              <div className="w-full">
                <AppNavbar />
              </div>
            </header>
          ) : null}

          {chrome ? <ImpersonationBanner /> : null}

          <div className="flex flex-1 overflow-hidden">
            {chrome ? <AppSideNav /> : null}

            <div className="flex flex-1 flex-col overflow-hidden">
              <main className={["flex-1 overflow-y-auto", mainClassName].filter(Boolean).join(" ")}>
                <div className={["w-full max-w-none px-3 py-4 lg:px-4", mainContentClassName].filter(Boolean).join(" ")}>
                  {children}
                </div>
              </main>

              {chrome ? <OnboardingChrome /> : null}
              {chrome ? <AppLayoutFooter /> : null}
            </div>
          </div>
        </div>
        </GamificationProvider>
        </ModuleSettingsProvider>
      </OnboardingProvider>
      </GuidedTourProvider>
    </div>
  );
}
