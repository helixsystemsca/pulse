import type { ReactNode } from "react";

export type StatusBadgeVariant = "success" | "warning" | "danger" | "neutral" | "info";

const variantClass: Record<StatusBadgeVariant, string> = {
  success: "app-badge-emerald",
  warning: "app-badge-amber",
  danger: "app-badge-red",
  neutral: "app-badge-slate",
  info: "app-badge-blue",
};

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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
