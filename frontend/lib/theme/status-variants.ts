/**
 * Status / badge class maps — align feature badges to globals `.app-badge-*`.
 */
import type { StatusBadgeVariant } from "@/components/ui/StatusBadge";

export const STATUS_BADGE_CLASS: Record<StatusBadgeVariant, string> = {
  success: "app-badge-emerald",
  warning: "app-badge-amber",
  danger: "app-badge-red",
  neutral: "app-badge-slate",
  info: "app-badge-blue",
};

export type ComplianceStatusVariant = "compliant" | "missing" | "expired" | "warning" | "neutral";

export const COMPLIANCE_BADGE_CLASS: Record<ComplianceStatusVariant, string> = {
  compliant: "app-badge-emerald",
  missing: "app-badge-amber",
  expired: "app-badge-red",
  warning: "app-badge-amber-soft",
  neutral: "app-badge-slate",
};

export const KPI_ACCENT_BAR_CLASS = {
  neutral: "bg-ds-border",
  success: "bg-ds-success",
  warning: "bg-ds-warning",
  danger: "bg-ds-danger",
} as const;
