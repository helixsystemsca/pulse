"use client";

import {
  defaultHybridSecondaryWindow,
  HYBRID_ROSTER_SHIFT_KEY,
  ROTATION_WEEKDAY_SHORT,
  shiftWindowFromHybridBand,
  type HybridRotationBand,
  type HybridRotationDraft,
} from "@/lib/workerRotation";
import { dsCheckboxClass, dsInputStackedClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { cn } from "@/lib/cn";

const MAIN_BAND_OPTIONS: { value: HybridRotationBand; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "afternoon", label: "Afternoon" },
  { value: "night", label: "Night" },
];

const ROTATION_PRESET_BUTTONS: { label: string; days: boolean[] }[] = [
  { label: "Sun–Wed", days: [true, true, true, true, false, false, false] },
  { label: "Tue–Sat", days: [false, false, true, true, true, true, true] },
  { label: "Mon–Fri", days: [false, true, true, true, true, true, false] },
];

type WeekdayPickerProps = {
  days: boolean[];
  onChange: (days: boolean[]) => void;
  idPrefix: string;
};

function WeekdayPicker({ days, onChange, idPrefix }: WeekdayPickerProps) {
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {ROTATION_PRESET_BUTTONS.map((p) => (
          <button
            key={`${idPrefix}-${p.label}`}
            type="button"
            className="rounded-md border border-ds-border bg-ds-card px-2.5 py-1 text-xs font-medium text-ds-foreground hover:bg-ds-muted/30"
            onClick={() => onChange([...p.days])}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border border-ds-border px-2.5 py-1 text-xs font-medium text-ds-muted hover:bg-ds-muted/30"
          onClick={() => onChange([false, false, false, false, false, false, false])}
        >
          Clear
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {ROTATION_WEEKDAY_SHORT.map((label, i) => (
          <label key={`${idPrefix}-${label}`} className="flex cursor-pointer items-center gap-1.5 text-sm text-ds-foreground">
            <input
              type="checkbox"
              className={dsCheckboxClass}
              checked={days[i] ?? false}
              onChange={() => {
                const next = [...days];
                next[i] = !next[i];
                onChange(next);
              }}
            />
            {label}
          </label>
        ))}
      </div>
    </>
  );
}

type Props = {
  draft: HybridRotationDraft;
  onChange: (draft: HybridRotationDraft) => void;
};

export function WorkerHybridRotationFields({ draft, onChange }: Props) {
  const patch = (partial: Partial<HybridRotationDraft>) => onChange({ ...draft, ...partial });

  return (
    <div className="sm:col-span-2 space-y-5 rounded-xl border border-[color-mix(in_srgb,var(--ds-accent)_22%,var(--ds-border))] bg-ds-secondary/20 p-4">
      <p className="text-xs leading-relaxed text-ds-muted">
        Hybrid rotation uses two repeating blocks. Pick your <span className="font-semibold text-ds-foreground">primary</span>{" "}
        band (day / afternoon / night), then set a <span className="font-semibold text-ds-foreground">secondary</span> block
        for Greenglade or other hours. Each weekday can only appear in one block.
      </p>

      <div className="space-y-3 rounded-lg border border-ds-border/80 bg-ds-primary/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={dsLabelClass}>Primary rotation</span>
          <select
            className={cn(dsInputStackedClass, "w-auto min-w-[9rem]")}
            value={draft.mainBand}
            aria-label="Primary shift band"
            onChange={(e) => {
              const mainBand = e.target.value as HybridRotationBand;
              const win = shiftWindowFromHybridBand(mainBand);
              patch({ mainBand, mainWindow: win });
            }}
          >
            {MAIN_BAND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={dsLabelClass} htmlFor="hybrid-main-start">
              Start
            </label>
            <input
              id="hybrid-main-start"
              type="time"
              className={dsInputStackedClass}
              value={draft.mainWindow.start}
              onChange={(e) => patch({ mainWindow: { ...draft.mainWindow, start: e.target.value } })}
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="hybrid-main-end">
              End
            </label>
            <input
              id="hybrid-main-end"
              type="time"
              className={dsInputStackedClass}
              value={draft.mainWindow.end}
              onChange={(e) => patch({ mainWindow: { ...draft.mainWindow, end: e.target.value } })}
            />
          </div>
        </div>
        <WeekdayPicker
          idPrefix="hybrid-main"
          days={draft.mainDays}
          onChange={(mainDays) => patch({ mainDays })}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-ds-border/80 bg-ds-primary/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={dsLabelClass}>Secondary rotation</span>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--ds-accent)] hover:underline"
            onClick={() => patch({ secondaryWindow: defaultHybridSecondaryWindow() })}
          >
            Use GG 4PM–12AM
          </button>
        </div>
        <p className="text-[11px] text-ds-muted">
          Typical Greenglade: 16:00–00:00. Drag shift code <span className="font-semibold">GG</span> on the schedule, or add{" "}
          <span className="font-semibold">GG3</span> badge for a 3PM–11PM overlay.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={dsLabelClass} htmlFor="hybrid-secondary-start">
              Start
            </label>
            <input
              id="hybrid-secondary-start"
              type="time"
              className={dsInputStackedClass}
              value={draft.secondaryWindow.start}
              onChange={(e) => patch({ secondaryWindow: { ...draft.secondaryWindow, start: e.target.value } })}
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="hybrid-secondary-end">
              End
            </label>
            <input
              id="hybrid-secondary-end"
              type="time"
              className={dsInputStackedClass}
              value={draft.secondaryWindow.end}
              onChange={(e) => patch({ secondaryWindow: { ...draft.secondaryWindow, end: e.target.value } })}
            />
          </div>
        </div>
        <WeekdayPicker
          idPrefix="hybrid-secondary"
          days={draft.secondaryDays}
          onChange={(secondaryDays) => patch({ secondaryDays })}
        />
      </div>
    </div>
  );
}

export function emptyHybridRotationDraft(mainBand: HybridRotationBand = "afternoon"): HybridRotationDraft {
  const mainWindow = shiftWindowFromHybridBand(mainBand);
  return {
    mainBand,
    mainDays: [false, false, false, false, false, false, false],
    mainWindow,
    secondaryDays: [false, false, false, false, false, false, false],
    secondaryWindow: defaultHybridSecondaryWindow(),
  };
}

export { HYBRID_ROSTER_SHIFT_KEY };
