"use client";

/**
 * Main content column; adds left padding when signed in so body text clears the collapsed rail.
 */
import type { ReactNode } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type AppMainProps = {
  children: ReactNode;
  className?: string;
};

/** Reserves horizontal space for the floating left rail so content stays clear when the rail is collapsed. */
export function AppMain({ children, className = "" }: AppMainProps) {
  const { authed } = usePulseAuth();
  const gutter = authed ? "lg:pl-64" : "";
  return (
    <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${gutter} ${className}`.trim()}>{children}</main>
  );
}
