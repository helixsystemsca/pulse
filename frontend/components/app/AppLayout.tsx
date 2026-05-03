/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { InactivitySessionGuard } from "./InactivitySessionGuard";
import { ServerTimeSync } from "./ServerTimeSync";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";
import { ImpersonationBanner } from "./ImpersonationBanner";
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ds-secondary">
        <ModuleSettingsProvider>
        <GamificationProvider>
        <InactivitySessionGuard />
        <ServerTimeSync />
        <ProximityPromptHost />
        <div data-pulse-app-shell className="flex h-full w-full flex-col overflow-hidden">
          {chrome ? <div className="app-chrome-accent" aria-hidden /> : null}
          {chrome ? (
            <header className="relative z-50 flex h-14 shrink-0 items-center border-b border-ds-border bg-ds-primary px-4 shadow-none">
              <div className="w-full">
                <AppNavbar />
              </div>
            </header>
          ) : null}

          {chrome ? <ImpersonationBanner /> : null}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {chrome ? <AppSideNav /> : null}

            <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <main
                className={["relative z-0 flex-1 overflow-y-auto bg-ds-bg", mainClassName].filter(Boolean).join(" ")}
              >
                <div
                  className={[
                    "min-h-full w-full max-w-none bg-ds-bg px-3 py-4 lg:px-4",
                    mainContentClassName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {children}
                </div>
              </main>
            </div>
          </div>

          {chrome ? <AppLayoutFooter /> : null}
        </div>
        </GamificationProvider>
        </ModuleSettingsProvider>
    </div>
  );
}
