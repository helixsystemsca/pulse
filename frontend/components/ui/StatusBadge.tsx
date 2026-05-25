import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STATUS_BADGE_CLASS } from "@/lib/theme/status-variants";

export type StatusBadgeVariant = keyof typeof STATUS_BADGE_CLASS;

export function StatusBadge({
  variant,
  children,
  className = "",
}: {
  variant: StatusBadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
        STATUS_BADGE_CLASS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
