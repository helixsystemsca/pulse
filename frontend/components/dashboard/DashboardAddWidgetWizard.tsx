"use client";

import { useEffect, useMemo, useState } from "react";
import type { LayoutItem } from "react-grid-layout";
import {
  DASHBOARD_PAGE_WIDGET_CATALOG,
  type CustomDashboardWidgetConfig,
  type CustomWidgetSliceOptions,
  catalogPage,
  defaultSliceOptions,
  newCustomWidgetId,
} from "@/lib/dashboardPageWidgetCatalog";

type Step = 1 | 2 | 3;

const BTN =
  "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 border border-ds-border bg-ds-secondary text-ds-foreground hover:bg-ds-interactive-hover";
const BTN_PRIMARY =
  "rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 bg-[#2B4C7E] hover:bg-[#234066] dark:bg-sky-600 dark:hover:bg-sky-500";

export function DashboardAddWidgetWizard({
  open,
  mode,
  initialConfig,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initialConfig: CustomDashboardWidgetConfig | null;
  onClose: () => void;
  onSave: (config: CustomDashboardWidgetConfig, layoutItem: LayoutItem | null) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [pageId, setPageId] = useState<string>(DASHBOARD_PAGE_WIDGET_CATALOG[0]!.id);
  const [selectedSlices, setSelectedSlices] = useState<string[]>([]);
  const [sliceOptions, setSliceOptions] = useState<CustomWidgetSliceOptions>({});
  const [title, setTitle] = useState("");

  const page = useMemo(() => catalogPage(pageId), [pageId]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (mode === "edit" && initialConfig) {
      setPageId(initialConfig.pageId);
      setSelectedSlices([...initialConfig.sliceIds]);
      setSliceOptions(JSON.parse(JSON.stringify(initialConfig.sliceOptions)) as CustomWidgetSliceOptions);
      setTitle(initialConfig.title);
      setStep(2);
      return;
    }
    const first = DASHBOARD_PAGE_WIDGET_CATALOG[0]!;
    setPageId(first.id);
    setSelectedSlices(first.slices[0] ? [first.slices[0].id] : []);
    setSliceOptions(defaultSliceOptions(first, first.slices[0] ? [first.slices[0].id] : []));
    setTitle("");
  }, [open, mode, initialConfig]);

  useEffect(() => {
    if (!open || !page) return;
    setSliceOptions((prev) => {
      const next = { ...prev };
      for (const sid of selectedSlices) {
        if (!next[sid]) {
          const def = defaultSliceOptions(page, [sid]);
          if (def[sid]) next[sid] = def[sid]!;
        }
      }
      for (const k of Object.keys(next)) {
        if (!selectedSlices.includes(k)) delete next[k];
      }
      return next;
    });
  }, [open, page, selectedSlices]);

  useEffect(() => {
    if (!open || !page) return;
    if (title.trim()) return;
    const labels = selectedSlices
      .map((id) => page.slices.find((s) => s.id === id)?.label)
      .filter(Boolean) as string[];
    if (labels.length) setTitle(`${page.label}: ${labels.join(" · ")}`);
  }, [open, page, selectedSlices, title]);

  if (!open) return null;

  function toggleSlice(id: string) {
    setSelectedSlices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function canContinueFrom2(): boolean {
    return selectedSlices.length > 0;
  }

  function commit() {
    const p = catalogPage(pageId);
    if (!p || selectedSlices.length === 0) return;
    const id = mode === "edit" && initialConfig ? initialConfig.id : newCustomWidgetId();
    const config: CustomDashboardWidgetConfig = {
      id,
      pageId,
      sliceIds: [...selectedSlices].sort(),
      sliceOptions,
      title: title.trim() || `${p.label} peek`,
    };
    const layoutItem: LayoutItem | null =
      mode === "edit"
        ? null
        : { i: id, x: 0, y: Infinity, w: 6, h: 3, minW: 3, minH: 2 };
    onSave(config, layoutItem);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]" aria-label="Close" onClick={onClose} />
      <div
        className="relative max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.18)] dark:border-ds-border dark:bg-ds-primary"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-wiz-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="dash-wiz-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
              {mode === "edit" ? "Customize widget" : "Add page peek widget"}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-ds-muted">
              Step {step} of 3 — pick a module, choose what to surface, then tune options.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-ds-muted dark:hover:bg-ds-interactive-hover"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-ds-muted">Page</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DASHBOARD_PAGE_WIDGET_CATALOG.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPageId(p.id);
                    const firstSlice = p.slices[0]?.id;
                    setSelectedSlices(firstSlice ? [firstSlice] : []);
                    setSliceOptions(defaultSliceOptions(p, firstSlice ? [firstSlice] : []));
                  }}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    pageId === p.id
                      ? "border-[#2B4C7E] bg-sky-50/80 font-semibold text-[#2B4C7E] dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100"
                      : "border-black/10 hover:bg-slate-50 dark:border-ds-border dark:hover:bg-ds-interactive-hover"
                  }`}
                >
                  <span className="block font-semibold text-slate-900 dark:text-gray-100">{p.label}</span>
                  <span className="mt-1 block text-xs text-slate-600 dark:text-ds-muted">{p.description}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={BTN} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 && page ? (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-ds-muted">
              Information from this page
            </p>
            <ul className="space-y-2">
              {page.slices.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer gap-3 rounded-lg border border-black/10 px-3 py-2 dark:border-ds-border">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={selectedSlices.includes(s.id)}
                      onChange={() => toggleSlice(s.id)}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-gray-100">{s.label}</span>
                      {s.description ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-ds-muted">{s.description}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" className={BTN} onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={!canContinueFrom2()} onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && page ? (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-ds-muted">Title</span>
              <input
                className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-slate-900 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {selectedSlices.map((sid) => {
              const slice = page.slices.find((s) => s.id === sid);
              if (!slice?.customizableFields?.length) return null;
              const row = sliceOptions[sid] ?? {};
              return (
                <fieldset key={sid} className="rounded-xl border border-black/10 p-3 dark:border-ds-border">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-ds-muted">
                    {slice.label}
                  </legend>
                  <div className="mt-2 space-y-3">
                    {slice.customizableFields.map((f) => (
                      <div key={f.key}>
                        {f.type === "boolean" ? (
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-gray-100">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={Boolean(row[f.key] ?? f.default)}
                              onChange={(e) =>
                                setSliceOptions((o) => ({
                                  ...o,
                                  [sid]: { ...row, [f.key]: e.target.checked },
                                }))
                              }
                            />
                            {f.label}
                          </label>
                        ) : (
                          <label className="block text-sm">
                            <span className="text-ds-muted">{f.label}</span>
                            <input
                              type="number"
                              min={f.min}
                              max={f.max}
                              step={f.step ?? 1}
                              className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 dark:border-ds-border dark:bg-ds-secondary"
                              value={Number(row[f.key] ?? f.default)}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value);
                                setSliceOptions((o) => ({
                                  ...o,
                                  [sid]: { ...row, [f.key]: Number.isFinite(n) ? n : f.default },
                                }));
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" className={BTN} onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" className={BTN_PRIMARY} disabled={selectedSlices.length === 0} onClick={() => commit()}>
                {mode === "edit" ? "Save" : "Add widget"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
