"use client";

import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ModuleSettingsForm } from "@/components/module-settings/ModuleSettingsModal";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import { resolvePlacementBandOptions } from "@/lib/schedule/placement-panel-options";
import type { PlacementBandOption, ShiftTypeConfig } from "@/lib/schedule/types";
import { PulseDrawer } from "./PulseDrawer";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const TABS = ["Organization", "General", "Placement panel", "Roles", "Shift types", "Staffing"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

function newRoleId(): string {
  return `role-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
}

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:text-gray-100 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/25";
const LABEL =
  "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5");

export function ScheduleSettingsModal({ open, onClose }: Props) {
  const { session } = usePulseAuth();
  const canEnableOtRiskMonitoring = sessionHasAnyRole(session, "manager", "company_admin");
  const settings = useScheduleStore((s) => s.settings);
  const roles = useScheduleStore((s) => s.roles);
  const shiftTypes = useScheduleStore((s) => s.shiftTypes);
  const shifts = useScheduleStore((s) => s.shifts);
  const setSettings = useScheduleStore((s) => s.setSettings);
  const setRoles = useScheduleStore((s) => s.setRoles);
  const setShiftTypes = useScheduleStore((s) => s.setShiftTypes);
  const setPendingRequests = useScheduleStore((s) => s.setPendingRequests);
  const pendingRequests = useScheduleStore((s) => s.pendingRequests);
  const resetDemo = useScheduleStore((s) => s.resetDemo);

  const [tab, setTab] = useState<Tab>("Organization");
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab("Organization");
      setRoleError(null);
    }
  }, [open]);

  if (!open) return null;

  function addRole() {
    setRoles([...roles, { id: newRoleId(), label: "New role" }]);
  }

  function updateRole(id: string, label: string) {
    setRoles(roles.map((r) => (r.id === id ? { ...r, label } : r)));
  }

  function removeRole(id: string) {
    if (shifts.some((s) => s.role === id)) {
      setRoleError("This role is used on shifts. Reassign or delete those shifts first.");
      return;
    }
    if (roles.length <= 1) return;
    setRoles(roles.filter((r) => r.id !== id));
  }

  function updateShiftType(key: ShiftTypeConfig["key"], patch: Partial<ShiftTypeConfig>) {
    setShiftTypes(shiftTypes.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  return (
    <PulseDrawer
      open={open}
      title="Schedule settings"
      subtitle="Organization rules, calendar defaults, roles, and staffing. Facilities are set under Organization."
      onClose={onClose}
      wide
      elevated
      placement="center"
      labelledBy="settings-drawer-title"
      footer={
        tab === "Organization" ? undefined : (
          <div className="flex flex-wrap items-center justify-end gap-4">
            <button
              type="button"
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={onClose}>
              Save & close
            </button>
          </div>
        )
      }
    >
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className={LABEL}>Section</p>
          <div className="mt-1.5 flex flex-wrap gap-1 rounded-[10px] border border-pulseShell-border bg-gray-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:bg-pulseShell-elevated/75 dark:shadow-none">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setRoleError(null);
                }}
                className={`rounded-lg px-2.5 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                  tab === t
                    ? "bg-ds-accent text-ds-accent-foreground shadow-sm ring-1 ring-ds-accent/25 dark:bg-[var(--pulse-segment-active-bg)] dark:text-[var(--pulse-segment-active-fg)] dark:shadow-sm dark:ring-1 dark:ring-sky-400/28"
                    : "text-gray-500 hover:bg-ds-interactive-hover-strong hover:text-gray-900 dark:text-slate-400 dark:hover:bg-ds-interactive-hover dark:hover:text-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {roleError ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
              {roleError}
            </p>
          ) : null}
          {tab === "Organization" ? (
            <ModuleSettingsForm moduleId="schedule" onCancel={() => setTab("General")} />
          ) : null}
          {tab === "General" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Work day start
                  </label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                    value={settings.workDayStart}
                    onChange={(e) => setSettings({ workDayStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Work day end
                  </label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                    value={settings.workDayEnd}
                    onChange={(e) => setSettings({ workDayEnd: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Time format</label>
                <select
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={settings.timeFormat}
                  onChange={(e) =>
                    setSettings({ timeFormat: e.target.value as "12h" | "24h" })
                  }
                >
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Shift duration presets</p>
                <ul className="mt-2 space-y-2">
                  {settings.shiftDurationPresets.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-pulseShell-border px-3 py-2 text-sm min-w-[6rem]"
                        value={p.label}
                        onChange={(e) =>
                          setSettings({
                            shiftDurationPresets: settings.shiftDurationPresets.map((x) =>
                              x.id === p.id ? { ...x, label: e.target.value } : x,
                            ),
                          })
                        }
                      />
                      <input
                        type="number"
                        min={1}
                        max={24}
                        className="w-20 rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                        value={p.hours}
                        onChange={(e) =>
                          setSettings({
                            shiftDurationPresets: settings.shiftDurationPresets.map((x) =>
                              x.id === p.id ? { ...x, hours: Number(e.target.value) || 1 } : x,
                            ),
                          })
                        }
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">hours</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Pending requests (demo counter for summary bar)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={pendingRequests}
                  onChange={(e) => setPendingRequests(Number(e.target.value) || 0)}
                />
              </div>
              <div className="border-t border-pulseShell-border pt-4">
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.confirm("Reset all schedule data to the built-in demo?")) {
                      resetDemo();
                    }
                  }}
                >
                  Reset demo data
                </button>
              </div>
            </div>
          ) : null}

          {tab === "Placement panel" ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-pulseShell-border bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm dark:from-slate-950 dark:to-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Shift window menu</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Labels and order for the Workers sidebar “Shift window” dropdown. Band hours still follow schedule
                      presets (day / afternoon / night) unless you change defaults in code.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-pulseShell-border bg-pulseShell-surface px-2.5 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                    onClick={() => setSettings({ placementBandOptions: undefined })}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Reset windows
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {resolvePlacementBandOptions(settings).map((o, idx, arr) => {
                    const enabledCount = arr.filter((x) => x.enabled !== false).length;
                    const canDisable = o.enabled !== false && enabledCount > 1;
                    return (
                      <li
                        key={o.band}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-pulseShell-border bg-white/80 px-2 py-2 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-slate-800"
                            disabled={idx === 0}
                            aria-label="Move up"
                            onClick={() => {
                              const opts = [...resolvePlacementBandOptions(settings)] as PlacementBandOption[];
                              [opts[idx - 1], opts[idx]] = [opts[idx]!, opts[idx - 1]!];
                              setSettings({ placementBandOptions: opts });
                            }}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-slate-800"
                            disabled={idx >= arr.length - 1}
                            aria-label="Move down"
                            onClick={() => {
                              const opts = [...resolvePlacementBandOptions(settings)] as PlacementBandOption[];
                              [opts[idx], opts[idx + 1]] = [opts[idx + 1]!, opts[idx]!];
                              setSettings({ placementBandOptions: opts });
                            }}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <code className="w-24 shrink-0 truncate rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-pulseShell-elevated dark:text-slate-400">
                          {o.band}
                        </code>
                        <input
                          className="min-w-[12rem] flex-1 rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                          value={o.label}
                          onChange={(e) => {
                            const opts = [...resolvePlacementBandOptions(settings)] as PlacementBandOption[];
                            opts[idx] = { ...opts[idx]!, label: e.target.value };
                            setSettings({ placementBandOptions: opts });
                          }}
                          aria-label={`Label for ${o.band}`}
                        />
                        <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            className="rounded border-pulseShell-border"
                            checked={o.enabled !== false}
                            disabled={!canDisable && o.enabled !== false}
                            onChange={(e) => {
                              const opts = [...resolvePlacementBandOptions(settings)] as PlacementBandOption[];
                              opts[idx] = { ...opts[idx]!, enabled: e.target.checked };
                              setSettings({ placementBandOptions: opts });
                            }}
                          />
                          Show
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-xl border border-pulseShell-border bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm dark:from-slate-950 dark:to-slate-900/80">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Role when placing</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Choose which duty roles appear in the Workers sidebar dropdown and in what order. Add or rename roles
                  in the <span className="font-semibold text-gray-700 dark:text-gray-200">Roles</span> tab.
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1 rounded-lg border border-pulseShell-border bg-pulseShell-surface px-2.5 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
                  onClick={() => setSettings({ placementPanelRoleIds: undefined })}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Use all roles (default order)
                </button>
                <ul className="mt-4 space-y-2">
                  {(() => {
                    const allIds = roles.map((r) => r.id);
                    const rawSel = settings.placementPanelRoleIds;
                    const hasCustom =
                      Array.isArray(rawSel) &&
                      rawSel.length > 0 &&
                      rawSel.some((id) => allIds.includes(id));
                    const menuIds = hasCustom
                      ? rawSel.filter((id) => allIds.includes(id))
                      : [...allIds];
                    const extras = roles.filter((r) => !menuIds.includes(r.id));
                    const rows = [
                      ...menuIds.map((id) => roles.find((r) => r.id === id)).filter(Boolean),
                      ...extras,
                    ] as typeof roles;

                    function setMenuIds(nextMenu: string[]) {
                      const cleaned = nextMenu.filter((id) => allIds.includes(id));
                      if (cleaned.length === 0) return;
                      setSettings({
                        placementPanelRoleIds: cleaned.length === allIds.length ? undefined : cleaned,
                      });
                    }

                    return rows.map((r) => {
                      const checked = menuIds.includes(r.id);
                      const mi = menuIds.indexOf(r.id);
                      const canMoveUp = checked && mi > 0;
                      const canMoveDown = checked && mi >= 0 && mi < menuIds.length - 1;
                      const cannotUncheckLast = checked && menuIds.length <= 1;

                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-pulseShell-border bg-white/80 px-2 py-2 dark:bg-slate-900/40"
                        >
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-slate-800"
                              disabled={!canMoveUp}
                              aria-label="Move role up"
                              onClick={() => {
                                const next = [...menuIds];
                                [next[mi - 1], next[mi]] = [next[mi]!, next[mi - 1]!];
                                setMenuIds(next);
                              }}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-slate-800"
                              disabled={!canMoveDown}
                              aria-label="Move role down"
                              onClick={() => {
                                const next = [...menuIds];
                                [next[mi], next[mi + 1]] = [next[mi + 1]!, next[mi]!];
                                setMenuIds(next);
                              }}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <code className="w-28 shrink-0 truncate rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-pulseShell-elevated dark:text-slate-400">
                            {r.id}
                          </code>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {r.label}
                          </span>
                          <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded border-pulseShell-border"
                              checked={checked}
                              disabled={cannotUncheckLast}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMenuIds([...menuIds, r.id]);
                                } else {
                                  setMenuIds(menuIds.filter((id) => id !== r.id));
                                }
                              }}
                            />
                            In menu
                          </label>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </div>
            </div>
          ) : null}

          {tab === "Roles" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Roles appear in shift assignments. Built-in IDs are recommended; custom IDs work for advanced setups.
              </p>
              {roles.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <code className="w-28 shrink-0 truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-pulseShell-elevated dark:text-slate-400">
                    {r.id}
                  </code>
                  <input
                    className="flex-1 rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                    value={r.label}
                    onChange={(e) => {
                      setRoleError(null);
                      updateRole(r.id, e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeRole(r.id)}
                    aria-label="Remove role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRole}
                className="inline-flex items-center gap-1 rounded-lg border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
              >
                <Plus className="h-4 w-4" />
                Add role
              </button>
            </div>
          ) : null}

          {tab === "Shift types" ? (
            <div className="space-y-4">
              {shiftTypes.map((t) => (
                <div key={t.key} className="rounded-md border border-pulseShell-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t.key}</p>
                  <input
                    className="mt-2 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                    value={t.label}
                    onChange={(e) => updateShiftType(t.key, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-lg border border-pulseShell-border px-3 py-2 text-xs font-mono"
                      value={t.bg}
                      onChange={(e) => updateShiftType(t.key, { bg: e.target.value })}
                      title="Tailwind bg class"
                      placeholder="bg-*"
                    />
                    <input
                      className="rounded-lg border border-pulseShell-border px-3 py-2 text-xs font-mono"
                      value={t.border}
                      onChange={(e) => updateShiftType(t.key, { border: e.target.value })}
                      placeholder="border-*"
                    />
                    <input
                      className="rounded-lg border border-pulseShell-border px-3 py-2 text-xs font-mono"
                      value={t.text}
                      onChange={(e) => updateShiftType(t.key, { text: e.target.value })}
                      placeholder="text-*"
                    />
                  </div>
                  <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${t.bg} ${t.border} ${t.text}`}>
                    Preview · {t.label || t.key}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "Staffing" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Minimum workers per shift
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={settings.staffing.minWorkersPerShift}
                  onChange={(e) =>
                    setSettings({
                      staffing: { ...settings.staffing, minWorkersPerShift: Number(e.target.value) || 1 },
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  className="rounded border-pulseShell-border"
                  checked={settings.staffing.requireSupervisor}
                  onChange={(e) =>
                    setSettings({
                      staffing: { ...settings.staffing, requireSupervisor: e.target.checked },
                    })
                  }
                />
                Require supervisor or lead coverage per day
              </label>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Max hours per worker (week) — OT heuristic
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={settings.staffing.maxHoursPerWorkerPerWeek}
                  onChange={(e) =>
                    setSettings({
                      staffing: {
                        ...settings.staffing,
                        maxHoursPerWorkerPerWeek: Number(e.target.value) || 40,
                      },
                    })
                  }
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-pulseShell-border"
                  disabled={!canEnableOtRiskMonitoring && !settings.staffing.otRiskMonitoringEnabled}
                  checked={settings.staffing.otRiskMonitoringEnabled === true}
                  onChange={(e) => {
                    const v = e.target.checked;
                    if (v && !canEnableOtRiskMonitoring) return;
                    setSettings({
                      staffing: { ...settings.staffing, otRiskMonitoringEnabled: v },
                    });
                  }}
                />
                <span>
                  <span className="font-semibold">Show OT risk in the schedule bar</span>
                  <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                    Off by default: the bar shows &quot;No OT risk&quot;. When enabled (managers and company admins
                    only), scheduled work hours are compared to the weekly cap above for each Mon–Sun week that touches
                    the month; one worker over the cap shows Moderate, two or more shows Elevated. Anyone can turn this
                    off again.
                  </span>
                </span>
              </label>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Required shifts per day (for fill %)
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={settings.requiredShiftsPerDay}
                  onChange={(e) => setSettings({ requiredShiftsPerDay: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Active worker target (denominator)
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-pulseShell-border px-3 py-2 text-sm"
                  value={settings.activeWorkerTarget}
                  onChange={(e) => setSettings({ activeWorkerTarget: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </PulseDrawer>
  );
}
