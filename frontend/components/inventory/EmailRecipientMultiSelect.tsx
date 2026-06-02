"use client";

import { cn } from "@/lib/cn";
import { dsFormHintClass } from "@/components/ui/ds-form-classes";

type Props = {
  title: string;
  description?: string;
  directory: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyHint?: string;
};

export function EmailRecipientMultiSelect({
  title,
  description,
  directory,
  selected,
  onChange,
  disabled = false,
  emptyHint = "Add notification contacts in Inventory setup to choose recipients here.",
}: Props) {
  if (!directory.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-pulse-muted dark:border-ds-border">
        {emptyHint}
      </div>
    );
  }

  const set = new Set(selected);

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">{title}</legend>
      {description ? <p className={dsFormHintClass}>{description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {directory.map((email) => {
          const checked = set.has(email);
          return (
            <label
              key={email}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                checked
                  ? "border-[#2B4C7E] bg-[#2B4C7E]/10 font-semibold text-pulse-navy dark:border-sky-500 dark:bg-sky-950/40 dark:text-gray-100"
                  : "border-slate-200 bg-white text-pulse-muted hover:border-slate-300 dark:border-ds-border dark:bg-ds-secondary",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  const next = new Set(selected);
                  if (checked) next.delete(email);
                  else next.add(email);
                  onChange([...next]);
                }}
              />
              {email}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
