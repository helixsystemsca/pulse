"use client";

import { cn } from "@/lib/cn";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import type { InventoryModuleConfig } from "@/lib/inventory/inventory-module-config";
import {
  APPROVAL_MODE_OPTIONS,
  ASSET_TYPE_OPTIONS,
  LOCATION_MODE_OPTIONS,
  PROCUREMENT_MODE_OPTIONS,
  REFERENCE_MODE_OPTIONS,
} from "@/lib/inventory/inventory-module-config";

const optionCardClass = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
    selected
      ? "border-ds-accent bg-ds-accent/10 ring-1 ring-ds-accent/30"
      : "border-ds-border bg-ds-secondary/20 hover:border-ds-accent/40",
  );

export function WizardStepIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-bold text-ds-foreground">{title}</h3>
      <p className="text-sm text-ds-muted">{description}</p>
    </div>
  );
}

export function InventoryStructureStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Inventory Structure"
        description="Choose what types of assets you want to track."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {ASSET_TYPE_OPTIONS.map((opt) => {
          const checked = value.asset_types.includes(opt.value);
          return (
            <label key={opt.value} className={optionCardClass(checked)}>
              <input
                type="checkbox"
                className="mt-1"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? value.asset_types.filter((t) => t !== opt.value)
                    : [...value.asset_types, opt.value];
                  onChange({ ...value, asset_types: next });
                }}
              />
              <span className="text-sm font-semibold text-ds-foreground">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function StorageLocationsStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Storage Locations"
        description="How is your inventory organized?"
      />
      <div className="space-y-2">
        {LOCATION_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionCardClass(value.location_mode === opt.value)}>
            <input
              type="radio"
              name="location_mode"
              className="mt-1"
              checked={value.location_mode === opt.value}
              onChange={() => onChange({ ...value, location_mode: opt.value })}
            />
            <span className="text-sm font-semibold text-ds-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
      <label className={optionCardClass(value.enable_shelf)}>
        <input
          type="checkbox"
          className="mt-1"
          checked={value.enable_shelf}
          onChange={(e) => onChange({ ...value, enable_shelf: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-semibold text-ds-foreground">Track shelf / bin sub-locations</span>
          <span className="mt-0.5 block text-xs text-ds-muted">
            Adds an optional shelf, bin, or rack field on items and a column in the inventory list.
          </span>
        </span>
      </label>
    </div>
  );
}

export function ProcurementWorkflowStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Procurement Workflow"
        description="How does your organization purchase inventory?"
      />
      <div className="space-y-2">
        {PROCUREMENT_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionCardClass(value.procurement_mode === opt.value)}>
            <input
              type="radio"
              name="procurement_mode"
              className="mt-1"
              checked={value.procurement_mode === opt.value}
              onChange={() => onChange({ ...value, procurement_mode: opt.value })}
            />
            <span className="text-sm font-semibold text-ds-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ProcurementTerminologyStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Procurement Terminology"
        description="Customize terminology used by your organization."
      />
      <div>
        <label className={dsLabelClass}>Primary procurement action label</label>
        <p className={dsFormHintClass}>
          Shown on material request export actions. Default: Export Request
        </p>
        <input
          className={cn(dsInputClass, "mt-2 w-full")}
          value={value.procurement_action_label}
          onChange={(e) => onChange({ ...value, procurement_action_label: e.target.value })}
          placeholder="Export Request"
        />
      </div>
    </div>
  );
}

export function TransactionReferencesStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Transaction References"
        description="Should inventory transactions be linked to work orders, projects, or other references?"
      />
      <div className="space-y-2">
        {REFERENCE_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionCardClass(value.reference_mode === opt.value)}>
            <input
              type="radio"
              name="reference_mode"
              className="mt-1"
              checked={value.reference_mode === opt.value}
              onChange={() => onChange({ ...value, reference_mode: opt.value })}
            />
            <span className="text-sm font-semibold text-ds-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ApprovalWorkflowStep({
  value,
  onChange,
}: {
  value: InventoryModuleConfig;
  onChange: (next: InventoryModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Approval Workflow"
        description="Does inventory procurement require approval?"
      />
      <div className="space-y-2">
        {APPROVAL_MODE_OPTIONS.map((opt) => (
          <label key={opt.value} className={optionCardClass(value.approval_mode === opt.value)}>
            <input
              type="radio"
              name="approval_mode"
              className="mt-1"
              checked={value.approval_mode === opt.value}
              onChange={() => onChange({ ...value, approval_mode: opt.value })}
            />
            <span className="text-sm font-semibold text-ds-foreground">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
