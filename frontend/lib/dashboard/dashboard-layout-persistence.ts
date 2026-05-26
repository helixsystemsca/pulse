import { apiFetch, isApiMode } from "@/lib/api";
import { DASHBOARD_LAYOUT_STORAGE_VERSION } from "@/lib/dashboard/tokens";
import type { WorkspaceLayout } from "@/lib/dashboard/workspace-layout";
import type { CustomDashboardWidgetConfig } from "@/lib/dashboardPageWidgetCatalog";

export type DashboardLayoutBundle = {
  version: number;
  layout: WorkspaceLayout;
  customWidgets: Record<string, CustomDashboardWidgetConfig>;
};

export function dashboardLayoutStorageKey(context: string): string {
  return `pulse_dashboard_layout_v${DASHBOARD_LAYOUT_STORAGE_VERSION}_${context}_standard`;
}

export function dashboardCustomWidgetsStorageKey(context: string): string {
  return `pulse_dashboard_widgets_v3_${context}_standard`;
}

function readLocalBundle(context: string): DashboardLayoutBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const layoutRaw = window.localStorage.getItem(dashboardLayoutStorageKey(context));
    if (!layoutRaw) return null;
    const layout = JSON.parse(layoutRaw) as WorkspaceLayout;
    let customWidgets: Record<string, CustomDashboardWidgetConfig> = {};
    const widgetsRaw = window.localStorage.getItem(dashboardCustomWidgetsStorageKey(context));
    if (widgetsRaw) {
      customWidgets = JSON.parse(widgetsRaw) as Record<string, CustomDashboardWidgetConfig>;
    }
    return {
      version: DASHBOARD_LAYOUT_STORAGE_VERSION,
      layout,
      customWidgets,
    };
  } catch {
    return null;
  }
}

function writeLocalBundle(context: string, bundle: DashboardLayoutBundle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dashboardLayoutStorageKey(context), JSON.stringify(bundle.layout));
    window.localStorage.setItem(dashboardCustomWidgetsStorageKey(context), JSON.stringify(bundle.customWidgets));
  } catch {
    /* quota / private mode */
  }
}

/** Browser timer id (`window.setTimeout`); avoid Node `Timeout` type from global `setTimeout`. */
const saveTimers = new Map<string, number>();

export type DashboardLayoutLoadResult = {
  bundle: DashboardLayoutBundle | null;
  source: "server" | "local" | "none";
};

/** Load layout for a dashboard context — server wins when API mode is enabled. */
export async function loadDashboardLayoutBundle(context: string): Promise<DashboardLayoutLoadResult> {
  if (isApiMode()) {
    try {
      const remote = await apiFetch<DashboardLayoutBundle | null>(
        `/api/v1/profile/dashboard-layouts/${encodeURIComponent(context)}`,
      );
      if (remote?.layout && typeof remote.layout === "object") {
        const bundle: DashboardLayoutBundle = {
          version: remote.version ?? DASHBOARD_LAYOUT_STORAGE_VERSION,
          layout: remote.layout,
          customWidgets: remote.customWidgets ?? {},
        };
        writeLocalBundle(context, bundle);
        return { bundle, source: "server" };
      }
    } catch {
      /* fall back to local cache */
    }
  }

  const local = readLocalBundle(context);
  if (local) return { bundle: local, source: "local" };
  return { bundle: null, source: "none" };
}

/** Persist layout to local cache immediately; sync to account when API mode is on (debounced). */
export function saveDashboardLayoutBundle(
  context: string,
  bundle: DashboardLayoutBundle,
  options?: { debounceMs?: number },
): void {
  writeLocalBundle(context, bundle);

  if (!isApiMode()) return;

  const debounceMs = options?.debounceMs ?? 450;
  const existing = saveTimers.get(context);
  if (existing) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    saveTimers.delete(context);
    void apiFetch(`/api/v1/profile/dashboard-layouts/${encodeURIComponent(context)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: bundle.version,
        layout: bundle.layout,
        customWidgets: bundle.customWidgets,
      }),
    }).catch(() => {
      /* local cache remains; will retry on next edit */
    });
  }, debounceMs);

  saveTimers.set(context, timer);
}

export function flushDashboardLayoutSave(context: string): void {
  const pending = saveTimers.get(context);
  if (pending) {
    window.clearTimeout(pending);
    saveTimers.delete(context);
  }
}
