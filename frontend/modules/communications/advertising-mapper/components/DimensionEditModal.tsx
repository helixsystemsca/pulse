"use client";

import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";
import {
  measurementToDisplayValue,
  parseMeasurementInput,
} from "@/modules/communications/advertising-mapper/lib/measurements";
import type { DimensionEditTarget, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  open: boolean;
  blockName: string;
  widthInches: number;
  heightInches: number;
  unit: MeasurementUnit;
  initialFocus: DimensionEditTarget;
  onClose: () => void;
  onApply: (widthInches: number, heightInches: number) => void;
};

export function DimensionEditModal({
  open,
  blockName,
  widthInches,
  heightInches,
  unit,
  initialFocus,
  onClose,
  onApply,
}: Props) {
  const [widthVal, setWidthVal] = useState(measurementToDisplayValue(widthInches, unit));
  const [heightVal, setHeightVal] = useState(measurementToDisplayValue(heightInches, unit));
  const [lockAspect, setLockAspect] = useState(true);
  const aspect = widthInches > 0 ? heightInches / widthInches : 1;

  useEffect(() => {
    if (!open) return;
    setWidthVal(measurementToDisplayValue(widthInches, unit));
    setHeightVal(measurementToDisplayValue(heightInches, unit));
  }, [open, widthInches, heightInches, unit]);

  if (!open) return null;

  const applyWidth = (next: number) => {
    setWidthVal(next);
    if (lockAspect && aspect > 0) {
      const wIn = parseMeasurementInput(next, unit);
      setHeightVal(measurementToDisplayValue(wIn * aspect, unit));
    }
  };

  const applyHeight = (next: number) => {
    setHeightVal(next);
    if (lockAspect && aspect > 0) {
      const hIn = parseMeasurementInput(next, unit);
      setWidthVal(measurementToDisplayValue(hIn / aspect, unit));
    }
  };

  const handleApply = () => {
    const w = parseMeasurementInput(widthVal, unit);
    const h = parseMeasurementInput(heightVal, unit);
    if (w < 6 || h < 6) return;
    onApply(w, h);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close dialog" onClick={onClose} />
      <DimEditDialogBody
        blockName={blockName}
        initialFocus={initialFocus}
        widthVal={widthVal}
        heightVal={heightVal}
        unit={unit}
        lockAspect={lockAspect}
        onClose={onClose}
        onApply={handleApply}
        onWidth={applyWidth}
        onHeight={applyHeight}
        onToggleLock={() => setLockAspect((v) => !v)}
      />
    </div>
  );
}

function DimEditDialogBody({
  blockName,
  initialFocus,
  widthVal,
  heightVal,
  unit,
  lockAspect,
  onClose,
  onApply,
  onWidth,
  onHeight,
  onToggleLock,
}: {
  blockName: string;
  initialFocus: DimensionEditTarget;
  widthVal: number;
  heightVal: number;
  unit: MeasurementUnit;
  lockAspect: boolean;
  onClose: () => void;
  onApply: () => void;
  onWidth: (v: number) => void;
  onHeight: (v: number) => void;
  onToggleLock: () => void;
}) {
  return (
    <div
      className="relative z-10 w-full max-w-sm rounded-xl border border-ds-border bg-ds-primary p-5 shadow-2xl"
      role="dialog"
      aria-labelledby="dim-edit-title"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="dim-edit-title" className="text-base font-semibold text-ds-foreground">
            Edit size
          </h3>
          <p className="text-xs text-ds-muted">{blockName}</p>
        </div>
        <button type="button" className="rounded-lg p-1 text-ds-muted hover:bg-ds-secondary" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-ds-muted">
        Editing {initialFocus === "width" ? "width" : "height"} — updates inventory geometry immediately.
      </p>
      <div className="mt-4 space-y-3">
        <DimensionField label="Width" value={widthVal} unit={unit} autoFocus={initialFocus === "width"} onChange={onWidth} />
        <div>
          <span className="text-xs font-semibold text-ds-muted">Height</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              step={unit === "ft" ? 0.5 : 1}
              autoFocus={initialFocus === "height"}
              className="flex-1 rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2 text-sm"
              value={heightVal}
              onChange={(e) => onHeight(Number(e.target.value))}
            />
            <span className="flex w-10 items-center justify-center rounded-lg border border-ds-border text-xs font-bold text-ds-muted">
              {unit}
            </span>
            <button
              type="button"
              title="Lock aspect ratio"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg border",
                lockAspect
                  ? "border-[var(--ds-accent)] bg-[var(--ds-accent)]/10 text-[var(--ds-accent)]"
                  : "border-ds-border text-ds-muted",
              )}
              onClick={onToggleLock}
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={buttonVariants({ intent: "secondary", surface: "light" })} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonVariants({ intent: "primary", surface: "light" })} onClick={onApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

function DimensionField({
  label,
  value,
  unit,
  autoFocus,
  onChange,
}: {
  label: string;
  value: number;
  unit: MeasurementUnit;
  autoFocus?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-ds-muted">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          type="number"
          min={0}
          step={unit === "ft" ? 0.5 : 1}
          autoFocus={autoFocus}
          className="flex-1 rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="flex w-10 items-center justify-center rounded-lg border border-ds-border text-xs font-bold text-ds-muted">
          {unit}
        </span>
      </div>
    </label>
  );
}
