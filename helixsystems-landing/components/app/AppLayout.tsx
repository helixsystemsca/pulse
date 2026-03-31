import type { ReactNode } from "react";
import { AppNavbar } from "./AppNavbar";
import { AppSideNav } from "./AppSideNav";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
};

export function AppLayout({ children, mainClassName = "" }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-white">
      <AppSideNav />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppNavbar />
        <main className={`min-h-0 flex-1 ${mainClassName}`.trim()}>{children}</main>
      </div>
    </div>
  );
}
