"use client";

import type { ReactNode } from "react";
import { useSidebarState } from "@/components/app/SidebarState";

type AppMainChromeColumnProps = {
  children: ReactNode;
  mainClassName?: string;
  mainContentClassName?: string;
};

/** Main scroll region + sidebar backdrop (desktop overlay); lives beside in-flow `AppSideNav`. */
export function AppMainChromeColumn({
  children,
  mainClassName = "",
  mainContentClassName = "",
}: AppMainChromeColumnProps) {
  const { isSidebarOpen, closeSidebar } = useSidebarState();

  return (
    <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:pl-14">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="absolute inset-0 z-40 hidden bg-black/35 lg:block"
          onClick={closeSidebar}
        />
      ) : null}
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
  );
}
