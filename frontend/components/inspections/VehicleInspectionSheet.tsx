"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Gauge,
  HardHat,
  Info,
  Lightbulb,
  PencilLine,
  Plus,
  Save,
  ShieldAlert,
  Signature,
  Trash2,
  TriangleAlert,
  Upload,
  Wind,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";

type InspectionStatus = "draft" | "in_progress" | "submitted";
type PassFail = "unset" | "pass" | "fail";

type PhotoItem = { id: string; file: File; url: string };

type VehicleInspectionState = {
  vehicle: "" | "F250" | "Silverado EV" | "Cruze";
  operatorName: string;
  shift: "" | "Day" | "Swing" | "Night";
  department: "" | "Maintenance" | "Operations" | "Parks" | "Admin";

  odometerOut: string;
  timeOut: string;
  fuelOut: "" | "Full" | "3/4" | "1/2" | "1/4" | "Empty";

  physical: Record<
    | "tires"
    | "mirrors"
    | "windshield"
    | "lights"
    | "wipers"
    | "leaks"
    | "brakes"
    | "horn",
    PassFail
  >;

  defects: Record<
    "scratches" | "dents" | "cracked_glass" | "interior_damage" | "warning_lights" | "other",
    boolean
  >;
  defectsNotes: string;

  photos: PhotoItem[];
  inspectionNotes: string;

  odometerIn: string;
  timeIn: string;
  fuelIn: "" | "Full" | "3/4" | "1/2" | "1/4" | "Empty";

  confirm: boolean;
  typedSignature: string;
  submittedAtIso: string | null;
};

function nowStamp(): string {
  return new Date().toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function numberOrNull(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function StatusPill({ status }: { status: InspectionStatus }) {
  const cls =
    status === "submitted"
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100 dark:text-emerald-100"
      : status === "in_progress"
        ? "border-sky-300/35 bg-sky-500/15 text-sky-950 dark:text-sky-100"
        : "border-amber-300/35 bg-amber-500/15 text-amber-950 dark:text-amber-100";

  const dot =
    status === "submitted" ? "bg-emerald-400" : status === "in_progress" ? "bg-sky-400" : "bg-amber-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur",
        cls,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {status === "draft" ? "Draft" : status === "in_progress" ? "In Progress" : "Submitted"}
    </span>
  );
}

function GlassSection({
  title,
  subtitle,
  icon,
  children,
  stickyId,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  stickyId: string;
}) {
  const Icon = icon;
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border border-ds-border/80 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(56,189,248,0.16),transparent_42%),radial-gradient(900px_circle_at_90%_10%,rgba(34,197,94,0.12),transparent_40%)] shadow-[0_18px_45px_rgba(15,23,42,0.10)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
        "backdrop-blur supports-[backdrop-filter]:bg-ds-secondary/55",
      )}
    >
      <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_45%_at_10%_0%,black,transparent)]">
        <div className="h-full w-full bg-[linear-gradient(135deg,rgba(56,189,248,0.18),rgba(34,197,94,0.10),rgba(99,102,241,0.12))]" />
      </div>
      <div className="relative p-5 sm:p-6">
        <div
          id={stickyId}
          className={cn(
            "sticky top-2 z-[2] -mx-2 mb-4 flex items-start justify-between gap-4 rounded-xl border border-ds-border/70 bg-ds-secondary/70 px-4 py-3 shadow-sm backdrop-blur",
            "sm:static sm:mx-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ds-border bg-ds-primary/70 shadow-sm">
                <Icon className="h-4 w-4 text-ds-foreground" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-tight text-ds-foreground">{title}</p>
                {subtitle ? <p className="mt-0.5 text-xs font-medium text-ds-muted">{subtitle}</p> : null}
              </div>
            </div>
          </div>
        </div>

        {children}
      </div>
    </Card>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <label className={dsLabelClass}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        {hint ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ds-muted">
            <Info className="h-3.5 w-3.5" aria-hidden />
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ChecklistRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: PassFail;
  onChange: (next: PassFail) => void;
}) {
  const Icon = icon;
  const tone =
    value === "pass"
      ? "border-emerald-400/35 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_10px_26px_rgba(16,185,129,0.12)]"
      : value === "fail"
        ? "border-rose-400/35 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.22),0_10px_26px_rgba(244,63,94,0.10)]"
        : "border-ds-border bg-ds-primary/45 shadow-sm";

  const cycle = useCallback(() => {
    onChange(value === "unset" ? "pass" : value === "pass" ? "fail" : "unset");
  }, [onChange, value]);

  return (
    <motion.button
      type="button"
      onClick={cycle}
      className={cn(
        "group relative flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-200",
        "hover:-translate-y-[1px] hover:border-ds-border/80 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
        tone,
      )}
      whileTap={{ scale: 0.99 }}
      layout
    >
      <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-50" />
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ds-border bg-ds-secondary/60 shadow-sm backdrop-blur">
          <Icon className="h-4.5 w-4.5 text-ds-foreground" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ds-foreground">{label}</span>
          <span className="mt-0.5 block text-xs font-medium text-ds-muted">
            {value === "unset" ? "Tap to mark pass / fail" : value === "pass" ? "Passed" : "Failed"}
          </span>
        </span>
      </div>

      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            value === "pass"
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-50"
              : "border-ds-border bg-ds-secondary/60 text-ds-muted group-hover:text-ds-foreground",
          )}
          aria-label="Pass"
        >
          <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
        </span>
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            value === "fail"
              ? "border-rose-400/40 bg-rose-500/20 text-rose-50"
              : "border-ds-border bg-ds-secondary/60 text-ds-muted group-hover:text-ds-foreground",
          )}
          aria-label="Fail"
        >
          <XCircle className="h-4.5 w-4.5" aria-hidden />
        </span>
      </span>
    </motion.button>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  className,
  placeholder,
  minRows = 4,
  id,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 22)}px`;
  }, [minRows]);

  useEffect(() => resize(), [resize, value]);

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        dsInputClass,
        "min-h-[6.5rem] resize-none leading-relaxed",
        invalid ? "border-rose-400/60 focus:border-rose-400/70 focus:ring-rose-500/20" : "",
        className ?? "",
      )}
      rows={minRows}
    />
  );
}

function GradientPrimaryButton({
  disabled,
  children,
  onClick,
  title,
}: {
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold tracking-tight text-white",
        "shadow-[0_18px_40px_rgba(16,185,129,0.24)] transition-[transform,box-shadow,filter] duration-200",
        "bg-[linear-gradient(135deg,rgba(16,185,129,0.98),rgba(56,189,248,0.96),rgba(99,102,241,0.94))]",
        "hover:-translate-y-[1px] hover:shadow-[0_22px_50px_rgba(56,189,248,0.22)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_18px_40px_rgba(16,185,129,0.24)]",
      )}
    >
      <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(700px_circle_at_20%_0%,rgba(255,255,255,0.35),transparent_42%)] opacity-70" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

export function VehicleInspectionSheet() {
  const [generatedAt] = useState(() => nowStamp());
  const [state, setState] = useState<VehicleInspectionState>(() => ({
    vehicle: "",
    operatorName: "",
    shift: "",
    department: "",
    odometerOut: "",
    timeOut: "",
    fuelOut: "",
    physical: {
      tires: "unset",
      mirrors: "unset",
      windshield: "unset",
      lights: "unset",
      wipers: "unset",
      leaks: "unset",
      brakes: "unset",
      horn: "unset",
    },
    defects: {
      scratches: false,
      dents: false,
      cracked_glass: false,
      interior_damage: false,
      warning_lights: false,
      other: false,
    },
    defectsNotes: "",
    photos: [],
    inspectionNotes: "",
    odometerIn: "",
    timeIn: "",
    fuelIn: "",
    confirm: false,
    typedSignature: "",
    submittedAtIso: null,
  }));

  const hasAnyDefect = useMemo(() => Object.values(state.defects).some(Boolean), [state.defects]);
  const odoOut = useMemo(() => numberOrNull(state.odometerOut), [state.odometerOut]);
  const odoIn = useMemo(() => numberOrNull(state.odometerIn), [state.odometerIn]);
  const distanceDriven = useMemo(() => {
    if (odoOut === null || odoIn === null) return null;
    const d = odoIn - odoOut;
    if (!Number.isFinite(d)) return null;
    return d >= 0 ? d : null;
  }, [odoIn, odoOut]);

  const requiredOk = useMemo(() => {
    if (!state.vehicle) return false;
    if (!state.operatorName.trim()) return false;
    if (!state.shift) return false;
    if (!state.department) return false;
    if (!state.odometerOut.trim()) return false;
    if (!state.timeOut.trim()) return false;
    if (!state.confirm) return false;
    if (!state.typedSignature.trim()) return false;
    return true;
  }, [
    state.confirm,
    state.department,
    state.odometerOut,
    state.operatorName,
    state.shift,
    state.timeOut,
    state.typedSignature,
    state.vehicle,
  ]);

  const completion = useMemo(() => {
    const checks: Array<boolean> = [
      Boolean(state.vehicle),
      Boolean(state.operatorName.trim()),
      Boolean(state.shift),
      Boolean(state.department),
      Boolean(state.odometerOut.trim()),
      Boolean(state.timeOut.trim()),
      Boolean(state.fuelOut),
      Object.values(state.physical).some((v) => v !== "unset"),
      Boolean(state.odometerIn.trim() || state.timeIn.trim() || state.fuelIn),
      state.confirm,
      Boolean(state.typedSignature.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return clampProgress((done / checks.length) * 100);
  }, [
    state.confirm,
    state.department,
    state.fuelIn,
    state.fuelOut,
    state.odometerIn,
    state.odometerOut,
    state.operatorName,
    state.physical,
    state.shift,
    state.timeIn,
    state.timeOut,
    state.typedSignature,
    state.vehicle,
  ]);

  const status: InspectionStatus = useMemo(() => {
    if (state.submittedAtIso) return "submitted";
    if (completion >= 15) return "in_progress";
    return "draft";
  }, [completion, state.submittedAtIso]);

  const setPhysical = useCallback((key: keyof VehicleInspectionState["physical"], next: PassFail) => {
    setState((s) => ({ ...s, physical: { ...s.physical, [key]: next } }));
  }, []);

  const toggleDefect = useCallback((key: keyof VehicleInspectionState["defects"]) => {
    setState((s) => ({ ...s, defects: { ...s.defects, [key]: !s.defects[key] } }));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setState((s) => {
      const next: PhotoItem[] = files.map((file) => ({ id: uid("photo"), file, url: URL.createObjectURL(file) }));
      return { ...s, photos: [...s.photos, ...next] };
    });
  }, []);

  useEffect(() => {
    return () => {
      state.photos.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removePhoto = useCallback((id: string) => {
    setState((s) => {
      const p = s.photos.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return { ...s, photos: s.photos.filter((x) => x.id !== id) };
    });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const list = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/"));
      addFiles(list);
    },
    [addFiles],
  );

  const clearForm = useCallback(() => {
    setState((s) => {
      s.photos.forEach((p) => URL.revokeObjectURL(p.url));
      return {
        ...s,
        vehicle: "",
        operatorName: "",
        shift: "",
        department: "",
        odometerOut: "",
        timeOut: "",
        fuelOut: "",
        physical: {
          tires: "unset",
          mirrors: "unset",
          windshield: "unset",
          lights: "unset",
          wipers: "unset",
          leaks: "unset",
          brakes: "unset",
          horn: "unset",
        },
        defects: {
          scratches: false,
          dents: false,
          cracked_glass: false,
          interior_damage: false,
          warning_lights: false,
          other: false,
        },
        defectsNotes: "",
        photos: [],
        inspectionNotes: "",
        odometerIn: "",
        timeIn: "",
        fuelIn: "",
        confirm: false,
        typedSignature: "",
        submittedAtIso: null,
      };
    });
  }, []);

  const saveDraft = useCallback(() => {
    // Local-only mock: leave structure "autosave-ready" (state serializable).
    setState((s) => ({ ...s }));
  }, []);

  const submit = useCallback(() => {
    if (!requiredOk) return;
    setState((s) => ({ ...s, submittedAtIso: new Date().toISOString() }));
  }, [requiredOk]);

  const headerGlow =
    status === "submitted"
      ? "from-emerald-500/16 via-sky-500/10 to-indigo-500/12"
      : status === "in_progress"
        ? "from-sky-500/16 via-emerald-500/10 to-indigo-500/12"
        : "from-amber-500/14 via-sky-500/10 to-indigo-500/12";

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-[1100px] space-y-6 pb-28">
        <Card
          className={cn(
            "relative overflow-hidden rounded-2xl border border-ds-border bg-ds-secondary/50 shadow-[0_18px_55px_rgba(15,23,42,0.12)] backdrop-blur",
          )}
        >
          <div className={cn("absolute inset-0 bg-[linear-gradient(135deg,var(--tw-gradient-stops))]", headerGlow)} />
          <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(55%_45%_at_20%_0%,black,transparent)]">
            <div className="h-full w-full bg-[linear-gradient(135deg,rgba(255,255,255,0.20),transparent_45%)]" />
          </div>

          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ds-border bg-ds-primary/70 shadow-sm">
                    <ClipboardCheck className="h-5 w-5 text-ds-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-lg font-extrabold tracking-tight text-ds-foreground sm:text-xl">
                      Daily Vehicle Inspection
                    </h1>
                    <p className="mt-0.5 text-xs font-medium text-ds-muted">Generated {generatedAt}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <StatusPill status={status} />
                <div className="flex min-w-[190px] flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-ds-muted">
                    <span>Completion</span>
                    <span className="tabular-nums text-ds-foreground">{completion}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-ds-border bg-ds-primary/40">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,rgba(16,185,129,0.95),rgba(56,189,248,0.95),rgba(99,102,241,0.92))]"
                      initial={{ width: 0 }}
                      animate={{ width: `${completion}%` }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Last inspection</p>
                <p className="mt-1 text-sm font-semibold text-ds-foreground">Yesterday · 4:12 PM</p>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">Completed by J. Rivera</p>
              </div>
              <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Vehicle profile</p>
                <p className="mt-1 text-sm font-semibold text-ds-foreground">Industrial fleet · Tablet flow</p>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">Optimized for fast line-item capture</p>
              </div>
              <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Shift context</p>
                <p className="mt-1 text-sm font-semibold text-ds-foreground">
                  {state.shift ? `${state.shift} shift` : "Select shift"}
                </p>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">
                  {state.department ? state.department : "Assign department for reporting"}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <GlassSection
          title="Vehicle information"
          subtitle="Identify the unit and operator for this inspection."
          icon={Car}
          stickyId="vehicle-info"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Vehicle" required>
              <select
                value={state.vehicle}
                onChange={(e) => setState((s) => ({ ...s, vehicle: e.target.value as VehicleInspectionState["vehicle"] }))}
                className={cn(dsSelectClass, !state.vehicle ? "border-rose-400/50" : "")}
              >
                <option value="">— Select vehicle —</option>
                <option value="F250">F250</option>
                <option value="Silverado EV">Silverado EV</option>
                <option value="Cruze">Cruze</option>
              </select>
            </Field>

            <Field label="Employee / Operator" required>
              <input
                value={state.operatorName}
                onChange={(e) => setState((s) => ({ ...s, operatorName: e.target.value }))}
                className={cn(dsInputClass, !state.operatorName.trim() ? "border-rose-400/50" : "")}
                placeholder="Name"
              />
            </Field>

            <Field label="Shift" required>
              <select
                value={state.shift}
                onChange={(e) => setState((s) => ({ ...s, shift: e.target.value as VehicleInspectionState["shift"] }))}
                className={cn(dsSelectClass, !state.shift ? "border-rose-400/50" : "")}
              >
                <option value="">— Select shift —</option>
                <option value="Day">Day</option>
                <option value="Swing">Swing</option>
                <option value="Night">Night</option>
              </select>
            </Field>

            <Field label="Department" required>
              <select
                value={state.department}
                onChange={(e) =>
                  setState((s) => ({ ...s, department: e.target.value as VehicleInspectionState["department"] }))
                }
                className={cn(dsSelectClass, !state.department ? "border-rose-400/50" : "")}
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

        <GlassSection
          title="Checkout information"
          subtitle="Capture starting readings before the vehicle goes into service."
          icon={Gauge}
          stickyId="checkout-info"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Odometer out" required hint="Numbers only">
              <input
                type="number"
                inputMode="numeric"
                value={state.odometerOut}
                onChange={(e) => setState((s) => ({ ...s, odometerOut: e.target.value }))}
                className={cn(dsInputClass, !state.odometerOut.trim() ? "border-rose-400/50" : "")}
                placeholder="e.g. 15320"
              />
            </Field>

            <Field label="Time checked out" required>
              <input
                type="time"
                value={state.timeOut}
                onChange={(e) => setState((s) => ({ ...s, timeOut: e.target.value }))}
                className={cn(dsInputClass, !state.timeOut.trim() ? "border-rose-400/50" : "")}
              />
            </Field>

            <Field label="Fuel / Battery level" required>
              <select
                value={state.fuelOut}
                onChange={(e) =>
                  setState((s) => ({ ...s, fuelOut: e.target.value as VehicleInspectionState["fuelOut"] }))
                }
                className={cn(dsSelectClass, !state.fuelOut ? "border-rose-400/50" : "")}
              >
                <option value="">— Select —</option>
                <option value="Full">Full</option>
                <option value="3/4">3/4</option>
                <option value="1/2">1/2</option>
                <option value="1/4">1/4</option>
                <option value="Empty">Empty</option>
              </select>
            </Field>
          </div>
        </GlassSection>

        <GlassSection
          title="Physical inspection"
          subtitle="Tap each row to mark pass/fail. Rows glow subtly by result."
          icon={HardHat}
          stickyId="physical"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ChecklistRow
              icon={Car}
              label="Tires appear properly inflated"
              value={state.physical.tires}
              onChange={(v) => setPhysical("tires", v)}
            />
            <ChecklistRow
              icon={ShieldAlert}
              label="Mirrors secure"
              value={state.physical.mirrors}
              onChange={(v) => setPhysical("mirrors", v)}
            />
            <ChecklistRow
              icon={Wind}
              label="Windshield undamaged"
              value={state.physical.windshield}
              onChange={(v) => setPhysical("windshield", v)}
            />
            <ChecklistRow
              icon={Lightbulb}
              label="Exterior lights operational"
              value={state.physical.lights}
              onChange={(v) => setPhysical("lights", v)}
            />
            <ChecklistRow
              icon={Droplets}
              label="Wipers functioning"
              value={state.physical.wipers}
              onChange={(v) => setPhysical("wipers", v)}
            />
            <ChecklistRow
              icon={TriangleAlert}
              label="No visible fluid leaks"
              value={state.physical.leaks}
              onChange={(v) => setPhysical("leaks", v)}
            />
            <ChecklistRow
              icon={Wrench}
              label="Brakes responsive"
              value={state.physical.brakes}
              onChange={(v) => setPhysical("brakes", v)}
            />
            <ChecklistRow
              icon={Upload}
              label="Horn operational"
              value={state.physical.horn}
              onChange={(v) => setPhysical("horn", v)}
            />
          </div>
        </GlassSection>

        <GlassSection
          title="Visual defects"
          subtitle="Tap any defect. Notes expands automatically when needed."
          icon={ShieldAlert}
          stickyId="defects"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["scratches", "Scratches"],
                ["dents", "Dents"],
                ["cracked_glass", "Cracked glass"],
                ["interior_damage", "Interior damage"],
                ["warning_lights", "Warning lights present"],
                ["other", "Other issue noted"],
              ] as const
            ).map(([k, label]) => {
              const on = state.defects[k];
              return (
                <motion.button
                  key={k}
                  type="button"
                  onClick={() => toggleDefect(k)}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    "group flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-200",
                    "hover:-translate-y-[1px] hover:border-ds-border/80 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
                    on
                      ? "border-amber-400/40 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,11,0.22),0_12px_30px_rgba(245,158,11,0.10)]"
                      : "border-ds-border bg-ds-primary/45",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ds-foreground">{label}</p>
                    <p className="mt-0.5 text-xs font-medium text-ds-muted">
                      {on ? "Flagged" : "Not flagged"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                      on
                        ? "border-amber-400/40 bg-amber-500/20 text-amber-950 dark:text-amber-100"
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
            {hasAnyDefect ? (
              <motion.div
                className="mt-4"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Field label="Defect notes" required hint="Required when any defect is flagged">
                  <AutoGrowTextarea
                    value={state.defectsNotes}
                    onChange={(v) => setState((s) => ({ ...s, defectsNotes: v }))}
                    placeholder="Add quick details (location, severity, and any safety concerns)…"
                    invalid={hasAnyDefect && !state.defectsNotes.trim()}
                    minRows={3}
                  />
                </Field>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </GlassSection>

        <GlassSection
          title="Photo documentation"
          subtitle="Drag & drop photos or use the upload button. Multiple images supported."
          icon={Camera}
          stickyId="photos"
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={onDrop}
            className={cn(
              "group relative flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ds-border bg-ds-primary/35 p-6 text-center shadow-sm",
              "transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-[1px] hover:border-ds-border/80",
            )}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(650px_circle_at_30%_0%,rgba(56,189,248,0.16),transparent_45%)] opacity-70" />
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-ds-border bg-ds-secondary/60 shadow-sm backdrop-blur">
              <Upload className="h-5 w-5 text-ds-foreground" aria-hidden />
            </span>
            <div className="relative">
              <p className="text-sm font-extrabold tracking-tight text-ds-foreground">Upload Vehicle Photos</p>
              <p className="mt-1 text-xs font-medium text-ds-muted">Drop images here, or browse to attach.</p>
            </div>
            <label className="relative">
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  addFiles(list);
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
                    title="Remove"
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
          stickyId="notes"
        >
          <Field label="Notes">
            <AutoGrowTextarea
              value={state.inspectionNotes}
              onChange={(v) => setState((s) => ({ ...s, inspectionNotes: v }))}
              placeholder="Describe any observed defects, operational concerns, or maintenance notes…"
              minRows={5}
            />
          </Field>
        </GlassSection>

        <GlassSection
          title="Return information"
          subtitle="Capture end readings and automatically calculate distance driven."
          icon={Gauge}
          stickyId="return"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Odometer in" hint="Numbers only">
              <input
                type="number"
                inputMode="numeric"
                value={state.odometerIn}
                onChange={(e) => setState((s) => ({ ...s, odometerIn: e.target.value }))}
                className={dsInputClass}
                placeholder="e.g. 15408"
              />
            </Field>

            <Field label="Time returned">
              <input
                type="time"
                value={state.timeIn}
                onChange={(e) => setState((s) => ({ ...s, timeIn: e.target.value }))}
                className={dsInputClass}
              />
            </Field>

            <Field label="Fuel / Battery level after use">
              <select
                value={state.fuelIn}
                onChange={(e) =>
                  setState((s) => ({ ...s, fuelIn: e.target.value as VehicleInspectionState["fuelIn"] }))
                }
                className={dsSelectClass}
              >
                <option value="">— Select —</option>
                <option value="Full">Full</option>
                <option value="3/4">3/4</option>
                <option value="1/2">1/2</option>
                <option value="1/4">1/4</option>
                <option value="Empty">Empty</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Distance driven</p>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-ds-foreground tabular-nums">
                {distanceDriven === null ? "—" : `${distanceDriven} mi`}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ds-muted">
                {distanceDriven === null ? "Enter odometer in/out to calculate." : "Calculated automatically."}
              </p>
            </div>
            <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Usage signals</p>
              <p className="mt-1 text-sm font-semibold text-ds-foreground">
                {state.fuelOut && state.fuelIn ? `${state.fuelOut} → ${state.fuelIn}` : "—"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ds-muted">Fuel / battery delta (manual review)</p>
            </div>
            <div className="rounded-2xl border border-ds-border bg-ds-primary/40 p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">Return window</p>
              <p className="mt-1 text-sm font-semibold text-ds-foreground">
                {state.timeOut && state.timeIn ? `${state.timeOut} → ${state.timeIn}` : "—"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-ds-muted">Time checked out vs returned</p>
            </div>
          </div>
        </GlassSection>

        <GlassSection
          title="Signature confirmation"
          subtitle="Confirm inspection before and after use."
          icon={Signature}
          stickyId="signature"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-ds-border bg-ds-primary/35 p-4 shadow-sm">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={state.confirm}
                  onChange={(e) => setState((s) => ({ ...s, confirm: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-ds-border bg-ds-primary text-ds-success focus:ring-2 focus:ring-[var(--ds-focus-ring)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ds-foreground">
                    I confirm this vehicle was inspected before and after use.
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-ds-muted">
                    Required to submit inspection.
                  </span>
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-ds-border bg-ds-primary/35 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold tracking-tight text-ds-foreground">Digital signature</p>
                <span className="text-xs font-semibold text-ds-muted">{new Date().toLocaleDateString()}</span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-ds-border bg-ds-secondary/60 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-ds-muted">Signature pad</p>
                  <div className="mt-2 flex h-16 items-center justify-center rounded-xl border border-ds-border bg-ds-primary/35 text-xs font-semibold text-ds-muted">
                    (placeholder)
                  </div>
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
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-950 dark:text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Submitted {new Date(state.submittedAtIso).toLocaleString()}
                </div>
              ) : null}
            </div>
          </div>
        </GlassSection>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-ds-border bg-ds-secondary/80 backdrop-blur supports-[backdrop-filter]:bg-ds-secondary/65">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-2xl"
              onClick={saveDraft}
              title="Save draft (local mock)"
            >
              <Save className="h-4 w-4" aria-hidden />
              Save Draft
            </Button>
            <Button variant="secondary" className="rounded-2xl" onClick={clearForm} title="Clear all fields">
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear Form
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-ds-border bg-ds-primary/35 px-3 py-2 text-xs font-semibold text-ds-muted">
              <span className={cn(!requiredOk ? "text-amber-700 dark:text-amber-200" : "text-emerald-700 dark:text-emerald-200")}>
                {!requiredOk ? "Complete required fields to submit" : "Ready to submit"}
              </span>
            </div>
            <GradientPrimaryButton
              disabled={!requiredOk || status === "submitted"}
              onClick={submit}
              title={!requiredOk ? "Complete required fields first" : status === "submitted" ? "Already submitted" : "Submit inspection"}
            >
              <Check className="h-4 w-4" aria-hidden />
              Submit Inspection
            </GradientPrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

