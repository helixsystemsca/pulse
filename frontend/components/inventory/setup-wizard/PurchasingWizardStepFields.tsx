"use client";

import { cn } from "@/lib/cn";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import type { PurchasingModuleConfig } from "@/lib/purchasing/purchasing-module-config";
import { WizardStepIntro } from "@/components/inventory/setup-wizard/InventoryWizardStepFields";

const card = (selected: boolean) =>
  cn(
    "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
    selected
      ? "border-ds-accent bg-ds-accent/10 ring-1 ring-ds-accent/30"
      : "border-ds-border bg-ds-secondary/20 hover:border-ds-accent/40",
  );

export function PurchasingHowYouBuyStep({
  value,
  onChange,
}: {
  value: PurchasingModuleConfig;
  onChange: (next: PurchasingModuleConfig) => void;
}) {
  const both = value.enable_replenishment_requests && value.enable_quick_purchases;
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Purchasing Configuration"
        description="How does your organization acquire materials?"
      />
      <label className={card(value.enable_replenishment_requests && !value.enable_quick_purchases)}>
        <input
          type="checkbox"
          className="mt-1"
          checked={value.enable_replenishment_requests && !value.enable_quick_purchases}
          onChange={() =>
            onChange({
              ...value,
              enable_replenishment_requests: true,
              enable_quick_purchases: false,
            })
          }
        />
        <span className="text-sm font-semibold">Inventory Replenishment</span>
      </label>
      <label className={card(!value.enable_replenishment_requests && value.enable_quick_purchases)}>
        <input
          type="checkbox"
          className="mt-1"
          checked={!value.enable_replenishment_requests && value.enable_quick_purchases}
          onChange={() =>
            onChange({
              ...value,
              enable_replenishment_requests: false,
              enable_quick_purchases: true,
            })
          }
        />
        <span className="text-sm font-semibold">Quick Purchases</span>
      </label>
      <label className={card(both)}>
        <input
          type="checkbox"
          className="mt-1"
          checked={both}
          onChange={() =>
            onChange({
              ...value,
              enable_replenishment_requests: true,
              enable_quick_purchases: true,
            })
          }
        />
        <span className="text-sm font-semibold">Both</span>
      </label>
    </div>
  );
}

export function PurchasingVendorsStep({
  value,
  onChange,
}: {
  value: PurchasingModuleConfig;
  onChange: (next: PurchasingModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro title="Vendor tracking" description="Do you track vendors?" />
      {(
        [
          { yes: true, label: "Yes" },
          { yes: false, label: "No" },
        ] as const
      ).map(({ yes, label }) => (
        <label key={label} className={card(value.enable_vendor_tracking === yes)}>
          <input
            type="radio"
            name="vendor_tracking"
            className="mt-1"
            checked={value.enable_vendor_tracking === yes}
            onChange={() => onChange({ ...value, enable_vendor_tracking: yes })}
          />
          <span className="text-sm font-semibold">{label}</span>
        </label>
      ))}
    </div>
  );
}

export function PurchasingReceiptsStep({
  value,
  onChange,
}: {
  value: PurchasingModuleConfig;
  onChange: (next: PurchasingModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro title="Receipts" description="Do purchases require receipts?" />
      <label className={card(!value.require_receipt_upload)}>
        <input
          type="radio"
          name="receipt_mode"
          className="mt-1"
          checked={!value.require_receipt_upload}
          onChange={() => onChange({ ...value, require_receipt_upload: false, enable_receipt_uploads: true })}
        />
        <span className="text-sm font-semibold">Optional</span>
      </label>
      <label className={card(value.require_receipt_upload)}>
        <input
          type="radio"
          name="receipt_mode"
          className="mt-1"
          checked={value.require_receipt_upload}
          onChange={() => onChange({ ...value, require_receipt_upload: true, enable_receipt_uploads: true })}
        />
        <span className="text-sm font-semibold">Required</span>
      </label>
    </div>
  );
}

export function PurchasingExportsStep({
  value,
  onChange,
}: {
  value: PurchasingModuleConfig;
  onChange: (next: PurchasingModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Monthly expense exports"
        description="Support company credit card reconciliation with monthly exports."
      />
      {(
        [
          { yes: true, label: "Yes" },
          { yes: false, label: "No" },
        ] as const
      ).map(({ yes, label }) => (
        <label key={label} className={card(value.enable_monthly_expense_exports === yes)}>
          <input
            type="radio"
            name="monthly_exports"
            className="mt-1"
            checked={value.enable_monthly_expense_exports === yes}
            onChange={() => onChange({ ...value, enable_monthly_expense_exports: yes })}
          />
          <span className="text-sm font-semibold">{label}</span>
        </label>
      ))}
    </div>
  );
}

export function PurchasingModuleNameStep({
  value,
  onChange,
}: {
  value: PurchasingModuleConfig;
  onChange: (next: PurchasingModuleConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <WizardStepIntro
        title="Module name"
        description="Label shown in navigation and headers."
      />
      <div>
        <label className={dsLabelClass}>Purchasing module label</label>
        <input
          className={cn(dsInputClass, "mt-2 w-full")}
          value={value.purchasing_label}
          onChange={(e) => onChange({ ...value, purchasing_label: e.target.value })}
          placeholder="Purchasing"
        />
      </div>
      <div>
        <label className={dsLabelClass}>Replenishment queue label</label>
        <p className={dsFormHintClass}>Replaces generic material-request wording in the UI.</p>
        <input
          className={cn(dsInputClass, "mt-2 w-full")}
          value={value.replenishment_label}
          onChange={(e) => onChange({ ...value, replenishment_label: e.target.value })}
          placeholder="Replenishment Queue"
        />
      </div>
    </div>
  );
}
