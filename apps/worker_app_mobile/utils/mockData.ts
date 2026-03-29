/**
 * Placeholder data for UI development — replace with API/store selectors later.
 */
import type { AlertItemData, ToolItemData } from "@/utils/uiTypes";

export const mockHome = {
  greetingName: "Jordan",
  shiftLabel: "Shift A · Floor 2",
  statusCards: [
    {
      id: "1",
      label: "Assigned",
      value: "12",
      hint: "tools",
      variant: "default" as const,
    },
    {
      id: "2",
      label: "Missing",
      value: "2",
      hint: "site-wide",
      variant: "danger" as const,
    },
    {
      id: "3",
      label: "Alerts",
      value: "4",
      hint: "open",
      variant: "warning" as const,
    },
  ],
  primaryActions: [
    { id: "scan", label: "Scan tool", variant: "primary" as const },
    { id: "report", label: "Report issue", variant: "secondary" as const },
  ],
} as const;

export const mockToolboxSearchPlaceholder = "Search tools…";

export const mockTools: ToolItemData[] = [
  {
    id: "t1",
    name: 'Torque wrench ½"',
    code: "TW-204-A",
    statusLabel: "With you",
    statusVariant: "success",
  },
  {
    id: "t2",
    name: "Multimeter Fluke",
    code: "MM-881",
    statusLabel: "In zone · Bay 3",
    statusVariant: "neutral",
  },
  {
    id: "t3",
    name: "Impact driver",
    code: "ID-12",
    statusLabel: "Missing",
    statusVariant: "danger",
  },
  {
    id: "t4",
    name: "Laser measure",
    code: "LM-02",
    statusLabel: "Check-out pending",
    statusVariant: "warning",
  },
];

export const mockAlertFilters = ["All", "Missing", "Maintenance"] as const;

export const mockAlerts: AlertItemData[] = [
  {
    id: "a1",
    title: "Missing · Impact driver",
    message: "Last seen Bay 3 · 14 min ago",
    timeLabel: "14m",
    severity: "critical",
  },
  {
    id: "a2",
    title: "Maintenance due",
    message: "Torque wrench calibration window",
    timeLabel: "1h",
    severity: "warning",
  },
  {
    id: "a3",
    title: "Inventory low",
    message: "Consumables bin C under threshold",
    timeLabel: "3h",
    severity: "info",
  },
];

export const mockProfile = {
  initials: "JM",
  name: "Jordan Mills",
  role: "Field technician",
  email: "jordan.mills@example.com",
  menuRows: [
    { id: "notifications", label: "Notifications", hint: "On" },
    { id: "language", label: "Language", hint: "English" },
    { id: "help", label: "Help & support", hint: "" },
  ] as const,
};
