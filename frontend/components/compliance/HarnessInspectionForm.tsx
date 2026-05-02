"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { readSession } from "@/lib/pulse-session";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type PassFail = "pass" | "fail" | null;

type ChecklistGroupId = "labels" | "hardware" | "materials";

type HarnessInspectionState = {
  header: {
    inspectionDate: string; // yyyy-mm-dd
    inspectorName: string;
    equipmentId: string;
    manufacturer: string;
    model: string;
  };
  checklist: {
    labels: Record<string, PassFail>;
    hardware: Record<string, PassFail>;
    materials: Record<string, PassFail>;
  };
  notes: string;
  photo: File | null;
  result: "acceptable" | "unacceptable";
  reason: string;
};

export type HarnessInspectionSubmitPayload = {
  type: "harness_inspection";
  data: HarnessInspectionState;
  /** Work-item friendly shape (for "preventative"/inspection saving). */
  workItemDraft: {
    category: "preventative";
    title: string;
    description: string;
    flagged_for_follow_up: boolean;
    follow_up_reason: string | null;
    attachments: { kind: "photo"; filename: string }[];
    meta: Record<string, unknown>;
  };
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function humanLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PassFailToggle({
  value,
  onChange,
  id,
}: {
  value: PassFail;
  onChange: (v: PassFail) => void;
  id: string;
}) {
  const base =
    "inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors";
  const on = "border-ds-border bg-ds-secondary text-ds-foreground";
  const off = "border-ds-border bg-ds-primary text-ds-muted hover:bg-ds-secondary";

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Pass or fail">
      <button
        type="button"
        className={`${base} ${value === "pass" ? on : off}`}
        aria-pressed={value === "pass"}
        onClick={() => onChange(value === "pass" ? null : "pass")}
        id={`${id}-pass`}
      >
        PASS
      </button>
      <button
        type="button"
        className={`${base} ${value === "fail" ? "border-ds-danger/30 bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] text-ds-danger" : off}`}
        aria-pressed={value === "fail"}
        onClick={() => onChange(value === "fail" ? null : "fail")}
        id={`${id}-fail`}
      >
        FAIL
      </button>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
      <div className="h-1 w-full bg-ds-success" aria-hidden />
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold leading-tight text-ds-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-ds-muted">{subtitle}</p> : null}
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

const CHECKLIST: Record<
  ChecklistGroupId,
  { title: string; items: { key: string; label: string }[] }
> = {
  labels: {
    title: "Labels & Markings",
    items: [
      { key: "label_present", label: "Label Present" },
      { key: "label_legible", label: "Label Legible" },
      { key: "ansi_osha_markings", label: "ANSI/OSHA Markings" },
    ],
  },
  hardware: {
    title: "Hardware",
    items: [
      { key: "corrosion_rust_deformation", label: "Corrosion / Rust / Deformation" },
      { key: "buckles_functioning", label: "Buckles Functioning" },
      { key: "d_rings_condition", label: "D-Rings Condition" },
      { key: "adjustments_working", label: "Adjustments Working" },
    ],
  },
  materials: {
    title: "Material / Webbing",
    items: [
      { key: "cuts_burns_abrasions", label: "Cuts / Burns / Abrasions" },
      { key: "stitching_integrity", label: "Stitching Integrity" },
      { key: "fraying_tears", label: "Fraying / Tears" },
      { key: "impact_indicator", label: "Impact Indicator" },
    ],
  },
};

function emptyGroup(group: ChecklistGroupId) {
  return Object.fromEntries(CHECKLIST[group].items.map((i) => [i.key, null])) as Record<string, PassFail>;
}

export function HarnessInspectionForm({
  onSubmit,
}: {
  onSubmit?: (payload: HarnessInspectionSubmitPayload) => void;
}) {
  const session = readSession();
  const inspectorDefault = (session?.full_name?.trim() || session?.email?.trim() || "").slice(0, 80);

  const [state, setState] = useState<HarnessInspectionState>(() => ({
    header: {
      inspectionDate: todayYmd(),
      inspectorName: inspectorDefault,
      equipmentId: "",
      manufacturer: "",
      model: "",
    },
    checklist: {
      labels: emptyGroup("labels"),
      hardware: emptyGroup("hardware"),
      materials: emptyGroup("materials"),
    },
    notes: "",
    photo: null,
    result: "acceptable",
    reason: "",
  }));

  useEffect(() => {
    setState((s) => ({
      ...s,
      header: {
        ...s.header,
        inspectorName: s.header.inspectorName.trim() ? s.header.inspectorName : inspectorDefault,
      },
    }));
  }, [inspectorDefault]);

  const anyFails = useMemo(() => {
    const groups: ChecklistGroupId[] = ["labels", "hardware", "materials"];
    for (const g of groups) {
      const m = state.checklist[g];
      for (const v of Object.values(m)) {
        if (v === "fail") return true;
      }
    }
    return false;
  }, [state.checklist]);

  const canSubmit = useMemo(() => {
    if (!state.header.inspectionDate.trim()) return false;
    if (!state.header.inspectorName.trim()) return false;
    if (!state.header.equipmentId.trim()) return false;
    if (state.result === "unacceptable" && !state.reason.trim()) return false;
    return true;
  }, [state.header.inspectionDate, state.header.inspectorName, state.header.equipmentId, state.result, state.reason]);

  const submitPayload = useMemo<HarnessInspectionSubmitPayload>(() => {
    const title = `Harness inspection · ${state.header.equipmentId.trim() || "Equipment"}`;
    const checklistLines: string[] = [];
    (["labels", "hardware", "materials"] as const).forEach((g) => {
      checklistLines.push(`${CHECKLIST[g].title}:`);
      CHECKLIST[g].items.forEach((it) => {
        const v = state.checklist[g][it.key];
        checklistLines.push(`- ${it.label}: ${v ? v.toUpperCase() : "—"}`);
      });
      checklistLines.push("");
    });

    const description = [
      `Inspection date: ${state.header.inspectionDate}`,
      `Inspector: ${state.header.inspectorName}`,
      `Equipment ID/Serial: ${state.header.equipmentId}`,
      state.header.manufacturer.trim() ? `Manufacturer: ${state.header.manufacturer.trim()}` : null,
      state.header.model.trim() ? `Model: ${state.header.model.trim()}` : null,
      "",
      ...checklistLines,
      state.notes.trim() ? `Notes:\n${state.notes.trim()}` : null,
      "",
      `Overall result: ${state.result.toUpperCase()}`,
      state.result === "unacceptable" ? `Reason: ${state.reason.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const followUp = state.result === "unacceptable" || anyFails;

    return {
      type: "harness_inspection",
      data: state,
      workItemDraft: {
        category: "preventative",
        title,
        description,
        flagged_for_follow_up: followUp,
        follow_up_reason: state.result === "unacceptable" ? state.reason.trim() : anyFails ? "One or more checklist items failed." : null,
        attachments: state.photo ? [{ kind: "photo", filename: state.photo.name }] : [],
        meta: {
          inspection_kind: "harness",
          inspection_date: state.header.inspectionDate,
          inspector: state.header.inspectorName,
          equipment_id: state.header.equipmentId,
          manufacturer: state.header.manufacturer || null,
          model: state.header.model || null,
        },
      },
    };
  }, [anyFails, state]);

  const onHeaderChange = (k: keyof HarnessInspectionState["header"]) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setState((s) => ({ ...s, header: { ...s.header, [k]: v } }));
  };

  const setChecklistValue = (group: ChecklistGroupId, key: string, v: PassFail) => {
    setState((s) => ({ ...s, checklist: { ...s.checklist, [group]: { ...s.checklist[group], [key]: v } } }));
  };

  return (
    <SectionCard
      title="Harness Inspection"
      subtitle="A mobile-friendly inspection form for fall-protection harnesses. Submits a structured payload ready for preventative work items."
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-ds-foreground">Header</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Inspection date</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground" value={state.header.inspectionDate} onChange={onHeaderChange("inspectionDate")} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Inspector name</label>
              <input className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground" value={state.header.inspectorName} onChange={onHeaderChange("inspectorName")} placeholder="Name" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Equipment ID / serial</label>
              <input className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground" value={state.header.equipmentId} onChange={onHeaderChange("equipmentId")} placeholder="e.g. HARN-2041" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Manufacturer</label>
              <input className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground" value={state.header.manufacturer} onChange={onHeaderChange("manufacturer")} placeholder="e.g. 3M" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Model</label>
              <input className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground" value={state.header.model} onChange={onHeaderChange("model")} placeholder="Model / part number" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ds-foreground">Inspection checklist</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {(["labels", "hardware", "materials"] as const).map((group) => (
              <div key={group} className="rounded-xl border border-ds-border bg-ds-primary p-4">
                <p className="text-sm font-semibold text-ds-foreground">{CHECKLIST[group].title}</p>
                <div className="mt-3 space-y-3">
                  {CHECKLIST[group].items.map((it) => (
                    <div key={it.key} className="space-y-2">
                      <p className="text-sm text-ds-foreground">{it.label}</p>
                      <PassFailToggle
                        id={`${group}-${it.key}`}
                        value={state.checklist[group][it.key]}
                        onChange={(v) => setChecklistValue(group, it.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {anyFails ? (
            <p className="mt-3 text-xs font-semibold text-ds-danger">
              One or more items are marked FAIL. This will be flagged for follow-up.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-ds-border bg-ds-primary p-4">
            <h3 className="text-sm font-semibold text-ds-foreground">Notes</h3>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground"
              value={state.notes}
              onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Optional notes..."
            />
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-primary p-4">
            <h3 className="text-sm font-semibold text-ds-foreground">Photo (optional)</h3>
            <p className="mt-1 text-xs text-ds-muted">Attach a reference photo for documentation.</p>
            <input
              type="file"
              accept="image/*"
              className="mt-3 block w-full text-sm text-ds-muted file:mr-3 file:rounded-lg file:border file:border-ds-border file:bg-ds-secondary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ds-foreground hover:file:bg-ds-interactive-hover"
              onChange={(e) => setState((s) => ({ ...s, photo: e.target.files?.[0] ?? null }))}
            />
            {state.photo ? (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2">
                <p className="min-w-0 truncate text-xs font-semibold text-ds-foreground">{state.photo.name}</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-ds-muted hover:text-ds-foreground"
                  onClick={() => setState((s) => ({ ...s, photo: null }))}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-ds-border bg-ds-primary p-4">
          <h3 className="text-sm font-semibold text-ds-foreground">Summary</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                state.result === "acceptable"
                  ? "border-ds-border bg-ds-secondary text-ds-foreground"
                  : "border-ds-border bg-ds-primary text-ds-muted hover:bg-ds-secondary"
              }`}
              onClick={() => setState((s) => ({ ...s, result: "acceptable", reason: "" }))}
            >
              Acceptable
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                state.result === "unacceptable"
                  ? "border-ds-danger/30 bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)] text-ds-danger"
                  : "border-ds-border bg-ds-primary text-ds-muted hover:bg-ds-secondary"
              }`}
              onClick={() => setState((s) => ({ ...s, result: "unacceptable" }))}
            >
              Unacceptable
            </button>
          </div>
          {state.result === "unacceptable" ? (
            <div className="mt-3">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Reason (required)</label>
              <input
                className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground"
                value={state.reason}
                onChange={(e) => setState((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Why is the harness unacceptable?"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ds-muted">
            Required: inspection date, inspector name, equipment id. {state.result === "unacceptable" ? "Reason is required." : ""}
          </p>
          <button
            type="button"
            disabled={!canSubmit}
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm disabled:opacity-50")}
            onClick={() => onSubmit?.(submitPayload)}
          >
            Submit inspection
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

