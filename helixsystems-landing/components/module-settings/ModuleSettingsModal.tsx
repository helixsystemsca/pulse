"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ModuleId } from "@/lib/moduleSettings/defaults";
import { MODULE_SETTINGS_UI } from "@/lib/moduleSettings/uiMeta";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";

type Props = {
  moduleId: ModuleId;
  open: boolean;
  onClose: () => void;
};

export function ModuleSettingsModal({ moduleId, open, onClose }: Props) {
  const meta = MODULE_SETTINGS_UI[moduleId];
  const { settings, defaults, canConfigure, update, reset, loading } = useModuleSettings(moduleId);
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setMessage(null);
    }
  }, [open, settings]);

  const onSave = useCallback(async () => {
    if (!canConfigure) return;
    setSaving(true);
    setMessage(null);
    try {
      const ok = await update(draft as typeof settings);
      setMessage(ok ? "Saved." : "Could not save — reverted to server values.");
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  }, [canConfigure, draft, onClose, update]);

  const onReset = useCallback(async () => {
    if (!canConfigure) return;
    setSaving(true);
    setMessage(null);
    try {
      const ok = await reset();
      if (ok) {
        setDraft(defaults);
        setMessage("Reset to defaults.");
      } else setMessage("Reset failed.");
    } finally {
      setSaving(false);
    }
  }, [canConfigure, defaults, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl dark:border-ds-border dark:bg-ds-primary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-settings-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-ds-border">
          <div>
            <h2 id="module-settings-title" className="text-lg font-semibold text-pulse-navy dark:text-slate-100">
              {meta.title} settings
            </h2>
            <p className="mt-0.5 text-xs text-pulse-muted">
              Organization rules{canConfigure ? "" : " — view only (admins can edit)"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-pulse-muted hover:bg-slate-100 hover:text-pulse-navy dark:hover:bg-ds-interactive-hover"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-pulse-muted">Loading…</p>
          ) : (
            <div className="space-y-6">
              {meta.sections.map((sec) => (
                <section key={sec.id} className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-pulse-navy dark:text-slate-100">{sec.title}</h3>
                    {sec.description ? (
                      <p className="text-xs text-pulse-muted">{sec.description}</p>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    {sec.fields.map((f) => (
                      <div
                        key={f.key}
                        className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-3 dark:border-ds-border dark:bg-ds-secondary/95"
                      >
                        {f.type === "toggle" ? (
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-pulse-accent"
                              checked={Boolean((draft as Record<string, unknown>)[f.key])}
                              disabled={!canConfigure}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, [f.key]: e.target.checked }) as typeof draft)
                              }
                            />
                            <span>
                              <span className="block text-sm font-medium text-pulse-navy dark:text-slate-100">
                                {f.label}
                              </span>
                              <span className="mt-0.5 block text-xs text-pulse-muted">{f.description}</span>
                            </span>
                          </label>
                        ) : (
                          <label className="block">
                            <span className="text-sm font-medium text-pulse-navy dark:text-slate-100">{f.label}</span>
                            <p className="text-xs text-pulse-muted">{f.description}</p>
                            <input
                              type="number"
                              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-ds-border dark:bg-ds-secondary"
                              value={Number((draft as Record<string, unknown>)[f.key] ?? 0)}
                              disabled={!canConfigure}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                setDraft((d) => ({
                                  ...d,
                                  [f.key]: Number.isFinite(n) ? n : 0,
                                }) as typeof draft);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {message ? <p className="px-5 text-sm text-pulse-muted">{message}</p> : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-3 dark:border-ds-border">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-slate-100"
            onClick={() => void onReset()}
            disabled={!canConfigure || saving}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-pulse-muted hover:text-pulse-navy dark:hover:text-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#2B4C7E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#234066] disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            disabled={!canConfigure || saving}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
