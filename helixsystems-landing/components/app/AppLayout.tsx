/**
 * Authenticated shell: floating `AppSideNav` rail, top `AppNavbar`, and scrollable `AppMain`.
 */
import type { ReactNode } from "react";
import { AppMain } from "./AppMain";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
};

export function AppLayout({ children, mainClassName = "" }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen bg-white">
      <AppSideNav />
      <div className="flex min-h-screen min-w-0 flex-col">
        <AppNavbar />
        <AppMain className={mainClassName}>{children}</AppMain>
      </div>
    </div>
  );
}
