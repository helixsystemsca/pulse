import type { ReactNode } from "react";
import { AppNavbar } from "./AppNavbar";

type AppLayoutProps = {
  children: ReactNode;
  /** Applied to the main content region below the navbar. */
  mainClassName?: string;
};

export function AppLayout({ children, mainClassName = "" }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppNavbar />
      <main className={`min-h-0 flex-1 ${mainClassName}`.trim()}>{children}</main>
    </div>
  );
}
