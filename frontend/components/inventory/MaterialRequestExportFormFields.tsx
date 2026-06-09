"use client";

import type { MaterialRequestTemplateFormField } from "@/lib/inventoryMaterialRequestsService";
import { cn } from "@/lib/cn";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E] focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/20 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";

export type MaterialRequestHeaderValues = {
  project: string;
  location: string;
  cost_object: string;
  comments: string;
};

type Props = {
  fields: MaterialRequestTemplateFormField[];
  values: MaterialRequestHeaderValues;
  onChange: (key: keyof MaterialRequestHeaderValues, value: string) => void;
  busy?: boolean;
  loading?: boolean;
};

function fieldSpan(field: MaterialRequestTemplateFormField): string {
  if (field.multiline) return "sm:col-span-2";
  if (field.key === "location" || field.key === "comments") return "sm:col-span-2";
  return "sm:col-span-1";
}

export function MaterialRequestExportFormFields({ fields, values, onChange, busy, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-pulse-muted">Loading template options…</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.key as keyof MaterialRequestHeaderValues] ?? "";
        const disabled = Boolean(busy);
        const label = (
          <span className={LABEL}>
            {field.label}
            {field.required ? "" : " (optional)"}
          </span>
        );

        if (field.multiline || field.key === "comments") {
          return (
            <label key={field.key} className={cn("block space-y-1", fieldSpan(field))}>
              {label}
              <textarea
                className={cn(INPUT, "min-h-[88px] resize-y")}
                value={value}
                onChange={(e) => onChange(field.key as keyof MaterialRequestHeaderValues, e.target.value)}
                placeholder={field.placeholder ?? "Optional"}
                disabled={disabled}
                rows={3}
              />
            </label>
          );
        }

        if (field.options.length > 0) {
          return (
            <label key={field.key} className={cn("block space-y-1", fieldSpan(field))}>
              {label}
              <select
                className={INPUT}
                value={value}
                onChange={(e) => onChange(field.key as keyof MaterialRequestHeaderValues, e.target.value)}
                required={field.required}
                disabled={disabled}
              >
                {!field.required ? <option value="">Select…</option> : null}
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={field.key} className={cn("block space-y-1", fieldSpan(field))}>
            {label}
            <input
              className={INPUT}
              value={value}
              onChange={(e) => onChange(field.key as keyof MaterialRequestHeaderValues, e.target.value)}
              placeholder={field.placeholder ?? undefined}
              required={field.required}
              disabled={disabled}
            />
          </label>
        );
      })}
    </div>
  );
}
