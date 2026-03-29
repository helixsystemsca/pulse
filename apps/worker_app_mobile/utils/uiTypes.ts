export type StatusVariant = "default" | "success" | "warning" | "danger";

export type ToolItemData = {
  id: string;
  name: string;
  code: string;
  statusLabel: string;
  statusVariant: "success" | "warning" | "danger" | "neutral";
};

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertItemData = {
  id: string;
  title: string;
  message: string;
  timeLabel: string;
  severity: AlertSeverity;
};

export type ActionButtonVariant = "primary" | "secondary" | "ghost" | "danger";
