"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { ScheduleRoleDefinition, ShiftTypeConfig } from "@/lib/schedule/types";

const TABS = ["General", "Roles", "Shift types", "Zones", "Staffing"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  open: boolean;
  onClose: () => void;
};

function newRoleId(): string {
  return `role-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
}

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
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        className="relative flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="settings-title" className="text-lg font-semibold text-pulse-navy">
            Schedule settings
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-pulse-muted hover:bg-slate-100"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-slate-100 px-3">
          <div className="flex gap-1 overflow-x-auto py-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  tab === t
                    ? "bg-white text-pulse-navy shadow-sm ring-1 ring-slate-200/90"
                    : "text-pulse-muted hover:bg-slate-50 hover:text-pulse-navy"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {roleError ? (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {roleError}
            </p>
          ) : null}
          {tab === "General" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                    Work day start
                  </label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={settings.workDayStart}
                    onChange={(e) => setSettings({ workDayStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                    Work day end
                  </label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={settings.workDayEnd}
                    onChange={(e) => setSettings({ workDayEnd: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Time format</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">Shift duration presets</p>
                <ul className="mt-2 space-y-2">
                  {settings.shiftDurationPresets.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm min-w-[6rem]"
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
                        className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={p.hours}
                        onChange={(e) =>
                          setSettings({
                            shiftDurationPresets: settings.shiftDurationPresets.map((x) =>
                              x.id === p.id ? { ...x, hours: Number(e.target.value) || 1 } : x,
                            ),
                          })
                        }
                      />
                      <span className="text-xs text-pulse-muted">hours</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                  Pending requests (demo counter for summary bar)
                </label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={pendingRequests}
                  onChange={(e) => setPendingRequests(Number(e.target.value) || 0)}
                />
              </div>
              <div className="border-t border-slate-100 pt-4">
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
              <p className="text-sm text-pulse-muted">
                Roles appear in shift assignments. Built-in IDs are recommended; custom IDs work for advanced setups.
              </p>
              {roles.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <code className="w-28 shrink-0 truncate rounded bg-slate-100 px-2 py-1 text-xs text-pulse-muted">
                    {r.id}
                  </code>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={r.label}
                    onChange={(e) => {
                      setRoleError(null);
                      updateRole(r.id, e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-pulse-muted hover:bg-red-50 hover:text-red-700"
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add role
              </button>
            </div>
          ) : null}

          {tab === "Shift types" ? (
            <div className="space-y-4">
              {shiftTypes.map((t) => (
                <div key={t.key} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">{t.key}</p>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={t.label}
                    onChange={(e) => updateShiftType(t.key, { label: e.target.value })}
                    placeholder="Label"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                      value={t.bg}
                      onChange={(e) => updateShiftType(t.key, { bg: e.target.value })}
                      title="Tailwind bg class"
                      placeholder="bg-*"
                    />
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
                      value={t.border}
                      onChange={(e) => updateShiftType(t.key, { border: e.target.value })}
                      placeholder="border-*"
                    />
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
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
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={z.label}
                    onChange={(e) => updateZone(z.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-lg p-2 text-pulse-muted hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeZone(z.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="New zone name"
                  value={zoneInput}
                  onChange={(e) => setZoneInput(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg bg-pulse-accent px-4 py-2 text-sm font-semibold text-white hover:bg-pulse-accent-hover"
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
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                  Minimum workers per shift
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={settings.staffing.minWorkersPerShift}
                  onChange={(e) =>
                    setSettings({
                      staffing: { ...settings.staffing, minWorkersPerShift: Number(e.target.value) || 1 },
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-pulse-navy">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
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
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                  Max hours per worker (week) — OT heuristic
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                  Required shifts per day (for fill %)
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={settings.requiredShiftsPerDay}
                  onChange={(e) => setSettings({ requiredShiftsPerDay: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-pulse-muted">
                  Active worker target (denominator)
                </label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={settings.activeWorkerTarget}
                  onChange={(e) => setSettings({ activeWorkerTarget: Number(e.target.value) || 1 })}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            className="w-full rounded-xl bg-pulse-accent py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pulse-accent-hover sm:w-auto sm:px-6"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
