import type { KioskWidgetDefinition } from "@/lib/project-kiosk/types";

const STORAGE_KEY = "pulse_kiosk_widget_config_v1";

/** All panels rotate in the main body; left rail is fixed “on shift” (schedule + project tasks). */
export const DEFAULT_KIOSK_WIDGETS: KioskWidgetDefinition[] = [
  { id: "safety", label: "Safety reminders", isHighValue: false },
  { id: "handover", label: "Handover notes", isHighValue: false },
  { id: "task_board", label: "Task board (To-do)", isHighValue: false },
  { id: "team_insights", label: "Team insights & recognition", isHighValue: false },
  { id: "progress", label: "Progress", isHighValue: false },
  { id: "blocked", label: "Blocked work", isHighValue: false },
  { id: "active_work", label: "Active work summary", isHighValue: false },
  { id: "active_tasks", label: "Active work view", isHighValue: false },
  { id: "blockers", label: "Blockers view", isHighValue: false },
  { id: "progress_summary", label: "Progress summary", isHighValue: false },
];

export function loadKioskWidgetConfig(): KioskWidgetDefinition[] {
  if (typeof window === "undefined") return DEFAULT_KIOSK_WIDGETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KIOSK_WIDGETS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_KIOSK_WIDGETS;
    const byId = new Map(DEFAULT_KIOSK_WIDGETS.map((w) => [w.id, { ...w }]));
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const id = (row as { id?: string }).id;
      if (!id || !byId.has(id)) continue;
      const hv = (row as { isHighValue?: boolean }).isHighValue;
      if (typeof hv === "boolean") {
        byId.set(id, { ...byId.get(id)!, isHighValue: hv });
      }
    }
    return DEFAULT_KIOSK_WIDGETS.map((w) => byId.get(w.id) ?? w);
  } catch {
    return DEFAULT_KIOSK_WIDGETS;
  }
}

export function saveKioskWidgetConfig(widgets: KioskWidgetDefinition[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export function setWidgetHighValue(id: string, isHighValue: boolean): KioskWidgetDefinition[] {
  const next = loadKioskWidgetConfig().map((w) => (w.id === id ? { ...w, isHighValue } : w));
  saveKioskWidgetConfig(next);
  return next;
}
