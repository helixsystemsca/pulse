"use client";

import { cn } from "@/lib/cn";
import { COMPLIANCE_BADGE_CLASS, type ComplianceStatusVariant } from "@/lib/theme/status-variants";

export type ComplianceBadgeVariant = ComplianceStatusVariant;

export function ComplianceBadge({
  children,
  variant,
  className,
}: {
  children: React.ReactNode;
  variant: ComplianceBadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        COMPLIANCE_BADGE_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
