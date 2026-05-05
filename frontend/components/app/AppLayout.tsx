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
import { SidebarStateProvider } from "@/components/app/SidebarState";
import { AppMainChromeColumn } from "@/components/app/AppMainChromeColumn";

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
          <SidebarStateProvider>
            <InactivitySessionGuard />
            <ServerTimeSync />
            <ProximityPromptHost />
            <div data-pulse-app-shell className="flex h-full w-full flex-col overflow-hidden">
          {chrome ? (
            <header className="relative z-[100] flex shrink-0 flex-col bg-ds-primary shadow-none">
              <div className="flex min-h-[3.625rem] items-center border-b border-ds-border px-4 py-2 sm:min-h-14 sm:py-2">
                <div className="w-full">
                  <AppNavbar />
                </div>
              </div>
              <div className="app-chrome-accent" aria-hidden />
            </header>
          ) : null}

          {chrome ? <ImpersonationBanner /> : null}

          <div className="relative flex min-h-0 min-w-0 flex-1">
            {chrome ? <AppSideNav /> : null}
            {chrome ? (
              <AppMainChromeColumn mainClassName={mainClassName} mainContentClassName={mainContentClassName}>
                {children}
              </AppMainChromeColumn>
            ) : (
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
            )}
          </div>

          {chrome ? (
            <div className="shrink-0 lg:pl-14">
              <AppLayoutFooter />
            </div>
          ) : null}
            </div>
          </SidebarStateProvider>
        </GamificationProvider>
      </ModuleSettingsProvider>
    </div>
  );
}
