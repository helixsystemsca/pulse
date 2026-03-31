"use client";

import type { ReactNode } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type AppMainProps = {
  children: ReactNode;
  className?: string;
};

/** Reserves horizontal space for the floating left rail so content stays clear when the rail is collapsed. */
export function AppMain({ children, className = "" }: AppMainProps) {
  const { authed } = usePulseAuth();
  const gutter = authed ? "pl-[5rem] sm:pl-[5.25rem]" : "";
  return <main className={`min-h-0 flex-1 ${gutter} ${className}`.trim()}>{children}</main>;
}
