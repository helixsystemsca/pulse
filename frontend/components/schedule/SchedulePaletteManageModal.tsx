"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  BADGE_GROUP_OPTIONS,
  buildPaletteBadgeRegistry,
  isBuiltinPaletteBadge,
  listManageBadgeCodes,
  type CustomPaletteBadge,
  type PaletteBadgeConfig,
} from "@/lib/schedule/palette-config";
import {
  OPERATIONAL_BADGE_REGISTRY,
  type OperationalBadgeGroup,
} from "@/lib/schedule/operational-scheduling-model";
const FIELD =
  "w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-2.5 py-1.5 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-primary/40";

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  badgeConfig: PaletteBadgeConfig;
  onBadgeConfigChange: (next: PaletteBadgeConfig) => void;
};

export function SchedulePaletteManageModal({
  open,
  onClose,
  companyId,
  badgeConfig,
  onBadgeConfigChange,
}: Props) {
  const [err, setErr] = useState<string | null>(null);

  const registry = useMemo(() => buildPaletteBadgeRegistry(badgeConfig), [badgeConfig]);
  const badgeCodes = useMemo(() => listManageBadgeCodes(badgeConfig), [badgeConfig]);

  const [badgeDraft, setBadgeDraft] = useState<{
    id: string;
    code: string;
    label: string;
    group: OperationalBadgeGroup;
    detail: string;
  }>({ id: "", code: "", label: "", group: "workflow", detail: "" });

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setBadgeDraft({ id: "", code: "", label: "", group: "workflow", detail: "" });
  }, [open]);

  if (!open) return null;

  function persistBadgeConfig(next: PaletteBadgeConfig) {
    onBadgeConfigChange(next);
  }

  function toggleHideBuiltin(code: string) {
    const u = code.toUpperCase();
    const hidden = new Set(badgeConfig.hiddenBuiltinCodes.map((c) => c.toUpperCase()));
    if (hidden.has(u)) hidden.delete(u);
    else hidden.add(u);
    persistBadgeConfig({ ...badgeConfig, hiddenBuiltinCodes: [...hidden] });
  }

  function saveBadge() {
    setErr(null);
    const code = badgeDraft.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!code) {
      setErr("Badge code is required (letters, numbers, underscore).");
      return;
    }
    if (badgeDraft.id) {
      const customBadges = badgeConfig.customBadges.map((b) =>
        b.id === badgeDraft.id
          ? {
              ...b,
              code,
              label: badgeDraft.label.trim() || code,
              group: badgeDraft.group,
              detail: badgeDraft.detail.trim() || undefined,
            }
          : b,
      );
      persistBadgeConfig({ ...badgeConfig, customBadges });
    } else {
      if (isBuiltinPaletteBadge(code)) {
        setErr(`"${code}" is already a built-in badge. Unhide it below or pick another code.`);
        return;
      }
      const exists = badgeConfig.customBadges.some((b) => b.code === code);
      if (exists) {
        setErr(`Custom badge "${code}" already exists.`);
        return;
      }
      const row: CustomPaletteBadge = {
        id: `custom-${code}-${Date.now()}`,
        code,
        label: badgeDraft.label.trim() || code,
        group: badgeDraft.group,
        detail: badgeDraft.detail.trim() || undefined,
      };
      persistBadgeConfig({ ...badgeConfig, customBadges: [...badgeConfig.customBadges, row] });
    }
    setBadgeDraft({ id: "", code: "", label: "", group: "workflow", detail: "" });
  }

  function deleteCustomBadge(id: string) {
    if (!window.confirm("Remove this custom badge from the palette?")) return;
    persistBadgeConfig({
      ...badgeConfig,
      customBadges: badgeConfig.customBadges.filter((b) => b.id !== id),
    });
    if (badgeDraft.id === id) {
      setBadgeDraft({ id: "", code: "", label: "", group: "workflow", detail: "" });
    }
  }

  const editingBadge = Boolean(badgeDraft.id);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="palette-manage-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-pulseShell-border bg-pulseShell-surface shadow-xl dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-pulseShell-border px-4 py-3">
          <div>
            <h2 id="palette-manage-title" className="text-base font-semibold text-ds-foreground">
              Manage assignment palette
            </h2>
            <p className="mt-0.5 text-xs text-ds-muted">
              Assignment palette badges · Company: {companyId.slice(0, 8)}… · Shift codes: Schedule settings → Shift
              definitions
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-ds-muted hover:bg-ds-secondary/80"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {err ? (
            <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
              {err}
            </p>
          ) : null}

          <div className="space-y-4">
              <div className="rounded-lg border border-pulseShell-border/80 bg-ds-secondary/20 p-3">
                <h3 className="text-sm font-semibold text-ds-foreground">
                  {editingBadge ? "Edit custom badge" : "New custom badge"}
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-1">
                    <label className="text-[10px] font-semibold uppercase text-ds-muted">Code</label>
                    <input
                      className={FIELD}
                      value={badgeDraft.code}
                      disabled={editingBadge}
                      onChange={(e) =>
                        setBadgeDraft((d) => ({ ...d, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))
                      }
                      placeholder="COV2"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase text-ds-muted">Label</label>
                    <input
                      className={FIELD}
                      value={badgeDraft.label}
                      onChange={(e) => setBadgeDraft((d) => ({ ...d, label: e.target.value }))}
                      placeholder="Extra coverage"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[10px] font-semibold uppercase text-ds-muted">Group</label>
                    <select
                      className={FIELD}
                      value={badgeDraft.group}
                      onChange={(e) => setBadgeDraft((d) => ({ ...d, group: e.target.value as OperationalBadgeGroup }))}
                    >
                      {BADGE_GROUP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <label className="text-[10px] font-semibold uppercase text-ds-muted">Detail (tooltip)</label>
                    <input
                      className={FIELD}
                      value={badgeDraft.detail}
                      onChange={(e) => setBadgeDraft((d) => ({ ...d, detail: e.target.value }))}
                      placeholder="Optional hover text"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-pulseShell-border bg-ds-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={!badgeDraft.code.trim()}
                    onClick={saveBadge}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {editingBadge ? "Save" : "Create"}
                  </button>
                  {editingBadge ? (
                    <button
                      type="button"
                      className="rounded-md border border-pulseShell-border px-3 py-1.5 text-sm font-semibold text-ds-foreground"
                      onClick={() => setBadgeDraft({ id: "", code: "", label: "", group: "workflow", detail: "" })}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ds-foreground">Palette badges ({badgeCodes.length})</h3>
                <p className="mt-0.5 text-xs text-ds-muted">
                  Built-in badges can be hidden from the palette. Custom badges are stored for this company in the browser.
                </p>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-pulseShell-border/80">
                  {badgeCodes.map((code) => {
                    const def = registry[code] ?? OPERATIONAL_BADGE_REGISTRY[code];
                    const custom = badgeConfig.customBadges.find((b) => b.code === code);
                    const builtin = isBuiltinPaletteBadge(code);
                    const hidden = badgeConfig.hiddenBuiltinCodes.map((c) => c.toUpperCase()).includes(code);
                    return (
                      <li
                        key={code}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-pulseShell-border/60 px-3 py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-sm font-bold text-ds-foreground">{code}</span>
                          <span className="ml-2 text-xs text-ds-muted">{def.label}</span>
                          <span className="ml-2 rounded bg-ds-secondary/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ds-muted">
                            {builtin ? "Built-in" : "Custom"}
                          </span>
                          {hidden ? (
                            <span className="ml-1 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                              Hidden
                            </span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {builtin ? (
                            <button
                              type="button"
                              className="rounded border border-pulseShell-border px-2 py-1 text-xs font-semibold text-ds-foreground"
                              onClick={() => toggleHideBuiltin(code)}
                            >
                              {hidden ? "Show" : "Hide"}
                            </button>
                          ) : custom ? (
                            <>
                              <button
                                type="button"
                                className="rounded border border-pulseShell-border p-1 text-ds-foreground"
                                title="Edit"
                                onClick={() =>
                                  setBadgeDraft({
                                    id: custom.id,
                                    code: custom.code,
                                    label: custom.label,
                                    group: custom.group,
                                    detail: custom.detail ?? "",
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded border border-rose-500/40 p-1 text-rose-700 dark:text-rose-300"
                                title="Delete"
                                onClick={() => deleteCustomBadge(custom.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
        </div>

        <div className="border-t border-pulseShell-border px-4 py-3">
          <button
            type="button"
            className="w-full rounded-md border border-pulseShell-border bg-pulseShell-elevated py-2 text-sm font-semibold text-ds-foreground"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
