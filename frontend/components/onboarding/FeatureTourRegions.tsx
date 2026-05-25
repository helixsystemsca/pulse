import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Wraps primary page content for feature-page onboarding (`data-tour="feature-workspace"`). */
export function FeatureTourWorkspace({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-tour="feature-workspace" className={cn("min-h-0", className)}>
      {children}
    </div>
  );
}

/** Optional toolbar row (filters, tabs, week controls) for feature tours. */
export function FeatureTourToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-tour="feature-toolbar" className={className}>
      {children}
    </div>
  );
}
