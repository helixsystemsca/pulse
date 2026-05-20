"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  CircleDot,
  HardHat,
  Link2,
  PencilLine,
  Plus,
  Scissors,
  Shield,
  ShieldAlert,
  Signature,
  Tag,
  TriangleAlert,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { readSession } from "@/lib/pulse-session";
import { dsInputClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import {
  AutoGrowTextarea,
  ChecklistRow,
  Field,
  GlassSection,
  InspectionSheetFooter,
  InspectionSheetHeader,
  InspectionSheetLayout,
  clampProgress,
  frostInset,
  nowStamp,
  type InspectionStatus,
  type PassFail,
  uid,
} from "@/components/inspections/inspection-sheet-ui";

type ChecklistGroupId = "labels" | "hardware" | "materials";

type HarnessInspectionState = {
  inspectionDate: string;
  inspectorName: string;
  equipmentId: string;
  manufacturer: string;
  model: string;
  department: "" | "Maintenance" | "Operations" | "Parks" | "Admin";
  checklist: {
    labels: Record<string, PassFail>;
    hardware: Record<string, PassFail>;
    materials: Record<string, PassFail>;
  };
  notes: string;
  photos: { id: string; file: File; url: string }[];
  result: "acceptable" | "unacceptable";
  reason: string;
  confirm: boolean;
  typedSignature: string;
  submittedAtIso: string | null;
};

export type HarnessInspectionSubmitPayload = {
  type: "harness_inspection";
  data: Omit<HarnessInspectionState, "photos" | "submittedAtIso"> & {
    photoNames: string[];
  };
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

export type HarnessInspectionArchivePayload = {
  equipmentId: string;
  inspectorName: string;
  result: "acceptable" | "unacceptable";
  submittedAtIso: string;
};

const CHECKLIST: Record<
  ChecklistGroupId,
  { title: string; subtitle: string; icon: LucideIcon; items: { key: string; label: string; icon: LucideIcon }[] }
> = {
  labels: {
    title: "Labels & markings",
    subtitle: "Verify identification and compliance markings are present and legible.",
    icon: Tag,
    items: [
      { key: "label_present", label: "Label present", icon: Tag },
      { key: "label_legible", label: "Label legible", icon: BadgeCheck },
      { key: "ansi_osha_markings", label: "ANSI / OSHA markings", icon: Shield },
    ],
  },
  hardware: {
    title: "Hardware",
    subtitle: "Inspect buckles, D-rings, and metal components for damage or malfunction.",
    icon: Wrench,
    items: [
      { key: "corrosion_rust_deformation", label: "No corrosion, rust, or deformation", icon: ShieldAlert },
      { key: "buckles_functioning", label: "Buckles functioning", icon: Link2 },
      { key: "d_rings_condition", label: "D-rings in good condition", icon: CircleDot },
      { key: "adjustments_working", label: "Adjustments working", icon: Wrench },
    ],
  },
  materials: {
    title: "Material / webbing",
    subtitle: "Check webbing, stitching, and impact indicators for wear or damage.",
    icon: Scissors,
    items: [
      { key: "cuts_burns_abrasions", label: "No cuts, burns, or abrasions", icon: Scissors },
      { key: "stitching_integrity", label: "Stitching integrity", icon: Link2 },
      { key: "fraying_tears", label: "No fraying or tears", icon: TriangleAlert },
      { key: "impact_indicator", label: "Impact indicator OK", icon: ShieldAlert },
    ],
  },
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyGroup(group: ChecklistGroupId): Record<string, PassFail> {
  return Object.fromEntries(CHECKLIST[group].items.map((i) => [i.key, "unset" as PassFail]));
}

function initialState(inspectorDefault: string): HarnessInspectionState {
  return {
    inspectionDate: todayYmd(),
    inspectorName: inspectorDefault,
    equipmentId: "",
    manufacturer: "",
    model: "",
    department: "",
    checklist: {
      labels: emptyGroup("labels"),
      hardware: emptyGroup("hardware"),
      materials: emptyGroup("materials"),
    },
    notes: "",
    photos: [],
    result: "acceptable",
    reason: "",
    confirm: false,
    typedSignature: "",
    submittedAtIso: null,
  };
}

function allChecklistAnswered(checklist: HarnessInspectionState["checklist"]): boolean {
  for (const group of Object.values(checklist)) {
    for (const v of Object.values(group)) {
      if (v === "unset") return false;
    }
  }
  return true;
}

function anyChecklistFails(checklist: HarnessInspectionState["checklist"]): boolean {
  for (const group of Object.values(checklist)) {
    for (const v of Object.values(group)) {
      if (v === "fail") return true;
    }
  }
  return false;
}

export function HarnessInspectionSheet({
  onSubmit,
  onArchived,
}: {
  onSubmit?: (payload: HarnessInspectionSubmitPayload) => void;
  onArchived?: (payload: HarnessInspectionArchivePayload) => void;
}) {
  const session = readSession();
  const inspectorDefault = (session?.full_name?.trim() || session?.email?.trim() || "").slice(0, 80);
  const [generatedAt] = useState(() => nowStamp());
  const [state, setState] = useState<HarnessInspectionState>(() => initialState(inspectorDefault));

  useEffect(() => {
    setState((s) => ({
      ...s,
      inspectorName: s.inspectorName.trim() ? s.inspectorName : inspectorDefault,
    }));
  }, [inspectorDefault]);

  const anyFails = useMemo(() => anyChecklistFails(state.checklist), [state.checklist]);

  const requiredOk = useMemo(() => {
    if (!state.inspectionDate.trim()) return false;
    if (!state.inspectorName.trim()) return false;
    if (!state.equipmentId.trim()) return false;
    if (!state.confirm) return false;
    if (!state.typedSignature.trim()) return false;
    if (state.result === "unacceptable" && !state.reason.trim()) return false;
    return true;
  }, [
    state.confirm,
    state.equipmentId,
    state.inspectionDate,
    state.inspectorName,
    state.reason,
    state.result,
    state.typedSignature,
  ]);

  const completion = useMemo(() => {
    const checklistAnswered = allChecklistAnswered(state.checklist);
    const checks = [
      Boolean(state.inspectionDate.trim()),
      Boolean(state.inspectorName.trim()),
      Boolean(state.equipmentId.trim()),
      Boolean(state.manufacturer.trim() || state.model.trim()),
      Boolean(state.department),
      checklistAnswered,
      Boolean(state.notes.trim() || state.photos.length > 0),
      state.result === "acceptable" || (state.result === "unacceptable" && Boolean(state.reason.trim())),
      state.confirm,
      Boolean(state.typedSignature.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return clampProgress((done / checks.length) * 100);
  }, [state]);

  const status: InspectionStatus = useMemo(() => {
    if (state.submittedAtIso) return "submitted";
    if (completion >= 15) return "in_progress";
    return "draft";
  }, [completion, state.submittedAtIso]);

  const statCards = useMemo(
    () => [
      {
        label: "Last inspection",
        title: "No prior record",
        subtitle: "First harness inspection in this session",
      },
      {
        label: "Equipment profile",
        title: state.equipmentId.trim() || "Enter equipment ID",
        subtitle:
          state.manufacturer.trim() || state.model.trim()
            ? [state.manufacturer, state.model].filter(Boolean).join(" · ")
            : "Manufacturer and model for asset tracking",
      },
      {
        label: "Inspector context",
        title: state.inspectorName.trim() || "Inspector name required",
        subtitle: state.department ? `${state.department} · ${state.inspectionDate}` : state.inspectionDate,
      },
    ],
    [state.department, state.equipmentId, state.inspectionDate, state.inspectorName, state.manufacturer, state.model],
  );

  const setChecklist = useCallback((group: ChecklistGroupId, key: string, value: PassFail) => {
    setState((s) => ({
      ...s,
      checklist: { ...s.checklist, [group]: { ...s.checklist[group], [key]: value } },
    }));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setState((s) => ({
      ...s,
      photos: [...s.photos, ...files.map((file) => ({ id: uid("photo"), file, url: URL.createObjectURL(file) }))],
    }));
  }, []);

  const removePhoto = useCallback((id: string) => {
    setState((s) => {
      const p = s.photos.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return { ...s, photos: s.photos.filter((x) => x.id !== id) };
    });
  }, []);

  useEffect(() => {
    return () => {
      state.photos.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildSubmitPayload = useCallback((): HarnessInspectionSubmitPayload => {
    const title = `Harness inspection · ${state.equipmentId.trim() || "Equipment"}`;
    const checklistLines: string[] = [];
    (["labels", "hardware", "materials"] as const).forEach((g) => {
      checklistLines.push(`${CHECKLIST[g].title}:`);
      CHECKLIST[g].items.forEach((it) => {
        const v = state.checklist[g][it.key];
        checklistLines.push(`- ${it.label}: ${v === "unset" ? "—" : v.toUpperCase()}`);
      });
      checklistLines.push("");
    });

    const description = [
      `Inspection date: ${state.inspectionDate}`,
      `Inspector: ${state.inspectorName}`,
      `Equipment ID/Serial: ${state.equipmentId}`,
      state.manufacturer.trim() ? `Manufacturer: ${state.manufacturer.trim()}` : null,
      state.model.trim() ? `Model: ${state.model.trim()}` : null,
      state.department ? `Department: ${state.department}` : null,
      "",
      ...checklistLines,
      state.notes.trim() ? `Notes:\n${state.notes.trim()}` : null,
      "",
      `Overall result: ${state.result.toUpperCase()}`,
      state.result === "unacceptable" ? `Reason: ${state.reason.trim()}` : null,
      `Signed by: ${state.typedSignature.trim()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const followUp = state.result === "unacceptable" || anyFails;

    return {
      type: "harness_inspection",
      data: {
        inspectionDate: state.inspectionDate,
        inspectorName: state.inspectorName,
        equipmentId: state.equipmentId,
        manufacturer: state.manufacturer,
        model: state.model,
        department: state.department,
        checklist: state.checklist,
        notes: state.notes,
        result: state.result,
        reason: state.reason,
        confirm: state.confirm,
        typedSignature: state.typedSignature,
        photoNames: state.photos.map((p) => p.file.name),
      },
      workItemDraft: {
        category: "preventative",
        title,
        description,
        flagged_for_follow_up: followUp,
        follow_up_reason:
          state.result === "unacceptable"
            ? state.reason.trim()
            : anyFails
              ? "One or more checklist items failed."
              : null,
        attachments: state.photos.map((p) => ({ kind: "photo" as const, filename: p.file.name })),
        meta: {
          inspection_kind: "harness",
          inspection_date: state.inspectionDate,
          inspector: state.inspectorName,
          equipment_id: state.equipmentId,
          manufacturer: state.manufacturer || null,
          model: state.model || null,
          department: state.department || null,
        },
      },
    };
  }, [anyFails, state]);

  const clearForm = useCallback(() => {
    setState((s) => {
      s.photos.forEach((p) => URL.revokeObjectURL(p.url));
      return initialState(inspectorDefault);
    });
  }, [inspectorDefault]);

  const submit = useCallback(() => {
    if (!requiredOk) return;
    const payload = buildSubmitPayload();
    const submittedAtIso = new Date().toISOString();
    onSubmit?.(payload);
    onArchived?.({
      equipmentId: state.equipmentId.trim(),
      inspectorName: state.inspectorName.trim(),
      result: state.result,
      submittedAtIso,
    });
    clearForm();
  }, [buildSubmitPayload, clearForm, onArchived, onSubmit, requiredOk, state.equipmentId, state.inspectorName, state.result]);

  return (
    <InspectionSheetLayout>
      <InspectionSheetHeader
        title="Fall Protection Harness Inspection"
        generatedAt={generatedAt}
        status={status}
        completion={completion}
        statCards={statCards}
        icon={HardHat}
      />

      <GlassSection
        title="Harness information"
        subtitle="Identify the unit, inspector, and inspection date."
        icon={HardHat}
        stickyId="harness-info"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Inspection date" required>
            <input
              type="date"
              value={state.inspectionDate}
              onChange={(e) => setState((s) => ({ ...s, inspectionDate: e.target.value }))}
              className={cn(dsInputClass, !state.inspectionDate.trim() ? "border-rose-400/50" : "")}
            />
          </Field>
          <Field label="Inspector name" required>
            <input
              value={state.inspectorName}
              onChange={(e) => setState((s) => ({ ...s, inspectorName: e.target.value }))}
              className={cn(dsInputClass, !state.inspectorName.trim() ? "border-rose-400/50" : "")}
              placeholder="Name"
            />
          </Field>
          <Field label="Equipment ID / serial" required>
            <input
              value={state.equipmentId}
              onChange={(e) => setState((s) => ({ ...s, equipmentId: e.target.value }))}
              className={cn(dsInputClass, !state.equipmentId.trim() ? "border-rose-400/50" : "")}
              placeholder="e.g. HARN-2041"
            />
          </Field>
          <Field label="Manufacturer">
            <input
              value={state.manufacturer}
              onChange={(e) => setState((s) => ({ ...s, manufacturer: e.target.value }))}
              className={dsInputClass}
              placeholder="e.g. 3M"
            />
          </Field>
          <Field label="Model">
            <input
              value={state.model}
              onChange={(e) => setState((s) => ({ ...s, model: e.target.value }))}
              className={dsInputClass}
              placeholder="Model / part number"
            />
          </Field>
          <Field label="Department">
            <select
              value={state.department}
              onChange={(e) =>
                setState((s) => ({ ...s, department: e.target.value as HarnessInspectionState["department"] }))
              }
              className={dsSelectClass}
            >
              <option value="">— Select department —</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Operations">Operations</option>
              <option value="Parks">Parks</option>
              <option value="Admin">Admin</option>
            </select>
          </Field>
        </div>
      </GlassSection>

      {(["labels", "hardware", "materials"] as const).map((group) => {
        const section = CHECKLIST[group];
        const SectionIcon = section.icon;
        return (
          <GlassSection
            key={group}
            title={section.title}
            subtitle={section.subtitle}
            icon={SectionIcon}
            stickyId={`harness-${group}`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <ChecklistRow
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={state.checklist[group][item.key] ?? "unset"}
                  onChange={(v) => setChecklist(group, item.key, v)}
                />
              ))}
            </div>
            {anyFails && group === "materials" ? (
              <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                One or more items are marked FAIL. This inspection will be flagged for follow-up.
              </p>
            ) : null}
          </GlassSection>
        );
      })}

      <GlassSection
        title="Photo documentation"
        subtitle="Drag & drop photos or use the upload button. Multiple images supported."
        icon={Camera}
        stickyId="harness-photos"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addFiles(Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/")));
          }}
          className={cn(
            "group relative flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ds-border/50 bg-white/35 p-6 text-center shadow-sm backdrop-blur-md",
            "transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--ds-accent)_35%,var(--ds-border))] dark:bg-ds-secondary/25",
          )}
        >
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ds-border/45 bg-white/50 shadow-sm backdrop-blur-sm dark:bg-ds-secondary/45">
            <Upload className="h-5 w-5 text-[var(--ds-accent)]" aria-hidden />
          </span>
          <div className="relative">
            <p className="text-sm font-extrabold tracking-tight text-ds-foreground">Upload Harness Photos</p>
            <p className="mt-1 text-xs font-medium text-ds-muted">Drop images here, or browse to attach.</p>
          </div>
          <label className="relative">
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.currentTarget.value = "";
              }}
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-ds-border bg-ds-secondary/70 px-4 py-2 text-xs font-semibold text-ds-foreground shadow-sm transition-colors hover:bg-ds-secondary">
              <Upload className="h-4 w-4" aria-hidden />
              Browse files
            </span>
          </label>
        </div>

        {state.photos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {state.photos.map((p) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-2xl border border-ds-border bg-ds-primary/35 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.id)}
                  className={cn(
                    "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/20 bg-black/40 text-white opacity-0 backdrop-blur transition-opacity",
                    "group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
                  )}
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </GlassSection>

      <GlassSection
        title="Inspection notes"
        subtitle="Add any operational concerns or maintenance notes."
        icon={PencilLine}
        stickyId="harness-notes"
      >
        <Field label="Notes">
          <AutoGrowTextarea
            value={state.notes}
            onChange={(v) => setState((s) => ({ ...s, notes: v }))}
            placeholder="Describe any observed defects, operational concerns, or maintenance notes…"
            minRows={5}
          />
        </Field>
      </GlassSection>

      <GlassSection
        title="Inspection outcome"
        subtitle="Record the overall harness disposition before sign-off."
        icon={Shield}
        stickyId="harness-outcome"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["acceptable", "Acceptable for use"],
              ["unacceptable", "Unacceptable — remove from service"],
            ] as const
          ).map(([value, label]) => {
            const on = state.result === value;
            return (
              <motion.button
                key={value}
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    result: value,
                    reason: value === "acceptable" ? "" : s.reason,
                  }))
                }
                whileTap={{ scale: 0.99 }}
                className={cn(
                  "group flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-200",
                  "hover:-translate-y-[1px] hover:border-ds-border/80 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
                  on
                    ? value === "acceptable"
                      ? "border-stone-200/80 bg-stone-50/90 dark:border-stone-600/40 dark:bg-stone-900/35"
                      : "border-rose-300/40 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-950/25"
                    : "border-ds-border/50 bg-white/35 backdrop-blur-sm dark:bg-ds-secondary/30",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ds-foreground">{label}</p>
                  <p className="mt-0.5 text-xs font-medium text-ds-muted">{on ? "Selected" : "Tap to select"}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                    on
                      ? value === "acceptable"
                        ? "border-stone-300/60 bg-stone-100/90 text-stone-800 dark:border-stone-500/40 dark:bg-stone-800/60 dark:text-stone-100"
                        : "border-rose-400/40 bg-rose-500/20 text-rose-50"
                      : "border-ds-border bg-ds-secondary/60 text-ds-muted group-hover:text-ds-foreground",
                  )}
                  aria-hidden
                >
                  {on ? <Check className="h-4.5 w-4.5" /> : <Plus className="h-4.5 w-4.5" />}
                </span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {state.result === "unacceptable" ? (
            <motion.div
              className="mt-4"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Field label="Reason" required hint="Required when harness is unacceptable">
                <input
                  value={state.reason}
                  onChange={(e) => setState((s) => ({ ...s, reason: e.target.value }))}
                  className={cn(dsInputClass, !state.reason.trim() ? "border-rose-400/50" : "")}
                  placeholder="Why is the harness unacceptable?"
                />
              </Field>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={frostInset}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Checklist status</p>
            <p className="mt-1 text-sm font-semibold text-ds-foreground">
              {allChecklistAnswered(state.checklist) ? (anyFails ? "Failed items present" : "All items passed") : "Incomplete"}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ds-muted">Tap each row in the sections above</p>
          </div>
          <div className={frostInset}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Disposition</p>
            <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--ds-accent)]">
              {state.result === "acceptable" ? "Acceptable" : "Unacceptable"}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ds-muted">
              {state.result === "unacceptable" ? "Remove from service until repaired or replaced" : "OK to return to service"}
            </p>
          </div>
        </div>
      </GlassSection>

      <GlassSection
        title="Signature confirmation"
        subtitle="Confirm this harness was inspected per your program requirements."
        icon={Signature}
        stickyId="harness-signature"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={frostInset}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={state.confirm}
                onChange={(e) => setState((s) => ({ ...s, confirm: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-ds-border bg-ds-primary text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ds-foreground">
                  I confirm this harness was inspected and the outcome above is accurate.
                </span>
                <span className="mt-0.5 block text-xs font-medium text-ds-muted">Required to submit inspection.</span>
              </span>
            </label>
          </div>

          <motion.div className={frostInset}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold tracking-tight text-ds-foreground">Digital signature</p>
              <span className="text-xs font-semibold text-ds-muted">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-ds-border/45 bg-white/40 p-4 shadow-sm backdrop-blur-md dark:bg-ds-secondary/40">
                <p className="text-xs font-semibold text-ds-muted">Signature pad</p>
                <motion.div className="mt-2 flex h-16 items-center justify-center rounded-xl border border-ds-border/50 bg-white/30 text-xs font-semibold text-ds-muted backdrop-blur-sm dark:bg-ds-primary/25">
                  (placeholder)
                </motion.div>
              </div>
              <div>
                <Field label="Typed name" required hint="Fallback if pad unavailable">
                  <input
                    value={state.typedSignature}
                    onChange={(e) => setState((s) => ({ ...s, typedSignature: e.target.value }))}
                    className={cn(dsInputClass, !state.typedSignature.trim() ? "border-rose-400/50" : "")}
                    placeholder="Type full name"
                  />
                </Field>
              </div>
            </div>
            {state.submittedAtIso ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200/90 bg-stone-50/95 px-3 py-2 text-xs font-semibold text-stone-800 dark:border-stone-600/50 dark:bg-stone-900/45 dark:text-stone-100">
                <CheckCircle2 className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
                Submitted {new Date(state.submittedAtIso).toLocaleString()}
              </div>
            ) : null}
          </motion.div>
        </div>
      </GlassSection>

      <InspectionSheetFooter
        requiredOk={requiredOk}
        status={status}
        onSaveDraft={() => setState((s) => ({ ...s }))}
        onClear={clearForm}
        onSubmit={submit}
      />
    </InspectionSheetLayout>
  );
}

/** @deprecated Use `HarnessInspectionSheet` — kept for existing imports. */
export const HarnessInspectionForm = HarnessInspectionSheet;
