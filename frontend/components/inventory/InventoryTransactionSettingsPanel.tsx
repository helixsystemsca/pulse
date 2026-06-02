"use client";

import type { InventoryTransactionSettingsConfig } from "@/lib/inventory/register-form-config";

type Props = {
  value: InventoryTransactionSettingsConfig;
  onChange: (next: InventoryTransactionSettingsConfig) => void;
  disabled?: boolean;
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-pulse-border p-4 dark:border-ds-border">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-semibold text-pulse-navy dark:text-gray-100">{label}</span>
        <span className="mt-0.5 block text-sm text-pulse-muted">{description}</span>
      </span>
    </label>
  );
}

export function InventoryTransactionSettingsPanel({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-pulse-muted">
        Control issue/receive flows on the scanner and mobile kiosk. References use generic fields so work orders and
        other modules can plug in later.
      </p>
      <ToggleRow
        label="Enable location selection"
        description="Prompt for source (issue) or destination (receive) location before adding each line."
        checked={value.enable_location_selection}
        onChange={(enable_location_selection) => onChange({ ...value, enable_location_selection })}
        disabled={disabled}
      />
      <ToggleRow
        label="Enable batch transactions"
        description="Allow multiple items in one transaction with a review step."
        checked={value.enable_batch_transactions}
        onChange={(enable_batch_transactions) => onChange({ ...value, enable_batch_transactions })}
        disabled={disabled}
      />
      <ToggleRow
        label="Enable references"
        description="Show reference type, ID, and note fields on transaction screens."
        checked={value.enable_references}
        onChange={(enable_references) =>
          onChange({
            ...value,
            enable_references,
            require_reference: enable_references ? value.require_reference : false,
          })
        }
        disabled={disabled}
      />
      <ToggleRow
        label="Require reference before confirm"
        description="User must enter at least one reference field on the transaction or a line."
        checked={value.require_reference}
        onChange={(require_reference) => onChange({ ...value, require_reference })}
        disabled={disabled || !value.enable_references}
      />
    </div>
  );
}
