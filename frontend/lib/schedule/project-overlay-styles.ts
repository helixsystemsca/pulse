import type { CSSProperties } from "react";
import { getOrAssignProjectTintClass } from "@/lib/schedule/project-overlay-tints";

export type OperationalImpactLevel = "low" | "medium" | "high" | "critical";
export type StaffingPriority = "low" | "normal" | "high" | "critical";

export type ProjectBlackoutWindow = {
  start_date: string;
  end_date: string;
  label?: string | null;
};

export type ProjectScheduleOverlayMeta = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  show_on_schedule?: boolean;
  overlay_color?: string | null;
  operational_impact_level?: OperationalImpactLevel;
  staffing_priority?: StaffingPriority;
  blackout_windows?: ProjectBlackoutWindow[] | null;
  tintClass: string;
  /** Team labels from assignee ids when names unavailable. */
  assigned_team_label?: string | null;
  pending_pto_count?: number;
};

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function normalizeOverlayColor(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (HEX_COLOR.test(v)) return v;
  return null;
}

/** Readable bar chrome from server color or persisted tint fallback. */
export function projectBarPresentation(meta: Pick<ProjectScheduleOverlayMeta, "overlay_color" | "tintClass" | "id">): {
  className: string;
  style?: CSSProperties;
} {
  const hex = normalizeOverlayColor(meta.overlay_color);
  if (hex) {
    return {
      className: "rounded-md border shadow-sm",
      style: {
        backgroundColor: `${hex}33`,
        borderColor: `${hex}88`,
        color: hex,
      },
    };
  }
  return {
    className: `rounded-md border border-black/5 shadow-sm ${meta.tintClass || getOrAssignProjectTintClass(meta.id)}`,
  };
}

export function impactBorderAccent(level: OperationalImpactLevel | undefined): string {
  switch (level) {
    case "critical":
      return "ring-1 ring-rose-500/50";
    case "high":
      return "ring-1 ring-amber-500/40";
    case "low":
      return "opacity-90";
    default:
      return "";
  }
}

export const SCHEDULE_OVERLAY_STATUSES = new Set(["active", "future", "on_hold"]);

export const OVERLAY_TOGGLE_STORAGE_KEY = "pulse_schedule_project_overlay_visible";

function overlayToggleKey(departmentSlug?: string | null): string {
  const slug = (departmentSlug ?? "").trim().toLowerCase();
  return slug ? `${OVERLAY_TOGGLE_STORAGE_KEY}_${slug}` : OVERLAY_TOGGLE_STORAGE_KEY;
}

export function readOverlayTogglePreference(departmentSlug?: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(overlayToggleKey(departmentSlug));
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeOverlayTogglePreference(visible: boolean, departmentSlug?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(overlayToggleKey(departmentSlug), visible ? "1" : "0");
  } catch {
    /* ignore */
  }
}
