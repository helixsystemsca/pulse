"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { ShiftTypeConfig } from "@/lib/schedule/types";
import { PulseDrawer } from "./PulseDrawer";

const TABS = ["General", "Roles", "Shift types", "Zones", "Staffing"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

function newRoleId(): string {
  return `role-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
}

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:focus:border-blue-400/40 dark:focus:ring-blue-400/25";
const LABEL =
  "text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066]";

export function ScheduleSettingsModal({ open, onClose }: Props) {
  const settings = useScheduleStore((s) => s.settings);
  const roles = useScheduleStore((s) => s.roles);
  const shiftTypes = useScheduleStore((s) => s.shiftTypes);
  const zones = useScheduleStore((s) => s.zones);
  const shifts = useScheduleStore((s) => s.shifts);
  const setSettings = useScheduleStore((s) => s.setSettings);
  const setRoles = useScheduleStore((s) => s.setRoles);
  const setShiftTypes = useScheduleStore((s) => s.setShiftTypes);
  const addZone = useScheduleStore((s) => s.addZone);
  const updateZone = useScheduleStore((s) => s.updateZone);
  const removeZone = useScheduleStore((s) => s.removeZone);
  const setPendingRequests = useScheduleStore((s) => s.setPendingRequests);
  const pendingRequests = useScheduleStore((s) => s.pendingRequests);
  const resetDemo = useScheduleStore((s) => s.resetDemo);

  const [tab, setTab] = useState<Tab>("General");
  const [zoneInput, setZoneInput] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab("General");
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
      subtitle="Defaults for calendar behavior, roles, zones, and staffing rules"
      onClose={onClose}
      wide
      elevated
      labelledBy="settings-drawer-title"
      footer={
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
      }
    >
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className={LABEL}>Section</p>
          <div className="mt-1.5 flex flex-wrap gap-1 rounded-[10px] border border-gray-200 bg-gray-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-[#1F2937] dark:bg-[#0F172A]/90 dark:shadow-none">
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
                    ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-gray-200/90 dark:bg-[#111827] dark:text-blue-300 dark:ring-[#1F2937]"
                    : "text-gray-500 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
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
          {tab === "General" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Work day start
                  </label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
                    value={settings.workDayEnd}
                    onChange={(e) => setSettings({ workDayEnd: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Time format</label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                        className="flex-1 rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm min-w-[6rem]"
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
                        className="w-20 rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
                  value={pendingRequests}
                  onChange={(e) => setPendingRequests(Number(e.target.value) || 0)}
                />
              </div>
              <div className="border-t border-gray-200 dark:border-[#1F2937] pt-4">
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

          {tab === "Roles" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Roles appear in shift assignments. Built-in IDs are recommended; custom IDs work for advanced setups.
              </p>
              {roles.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <code className="w-28 shrink-0 truncate rounded bg-gray-100 dark:bg-[#0F172A] px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                    {r.id}
                  </code>
                  <input
                    className="flex-1 rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-[#1F2937] bg-white px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm hover:bg-gray-50 dark:hover:bg-[#111827]"
              >
                <Plus className="h-4 w-4" />
                Add role
              </button>
            </div>
          ) : null}

          {tab === "Shift types" ? (
            <div className="space-y-4">
              {shiftTypes.map((t) => (
                <div key={t.key} className="rounded-xl border border-gray-200 dark:border-[#1F2937] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{t.key}</p>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
                    value={t.label}
                    onChange={(e) => updateShiftType(t.key, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-xs font-mono"
                      value={t.bg}
                      onChange={(e) => updateShiftType(t.key, { bg: e.target.value })}
                      title="Tailwind bg class"
                      placeholder="bg-*"
                    />
                    <input
                      className="rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-xs font-mono"
                      value={t.border}
                      onChange={(e) => updateShiftType(t.key, { border: e.target.value })}
                      placeholder="border-*"
                    />
                    <input
                      className="rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-xs font-mono"
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

          {tab === "Zones" ? (
            <div className="space-y-3">
              {zones.map((z) => (
                <div key={z.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
                    value={z.label}
                    onChange={(e) => updateZone(z.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeZone(z.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
                  placeholder="New zone name"
                  value={zoneInput}
                  onChange={(e) => setZoneInput(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-[#3B82F6] dark:hover:bg-blue-500"
                  onClick={() => {
                    if (!zoneInput.trim()) return;
                    addZone(zoneInput.trim());
                    setZoneInput("");
                  }}
                >
                  Add
                </button>
              </div>
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
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                  className="rounded border-gray-300 dark:border-[#1F2937]"
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
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Required shifts per day (for fill %)
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-[#1F2937] px-3 py-2 text-sm"
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
