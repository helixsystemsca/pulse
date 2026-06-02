"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { InventoryRegisterFieldsEditor } from "@/components/inventory/InventoryRegisterFieldsEditor";
import {
  ApprovalWorkflowStep,
  InventoryStructureStep,
  ProcurementTerminologyStep,
  ProcurementWorkflowStep,
  StorageLocationsStep,
  TransactionReferencesStep,
} from "@/components/inventory/setup-wizard/InventoryWizardStepFields";
import {
  PurchasingExportsStep,
  PurchasingHowYouBuyStep,
  PurchasingModuleNameStep,
  PurchasingReceiptsStep,
  PurchasingVendorsStep,
} from "@/components/inventory/setup-wizard/PurchasingWizardStepFields";
import {
  inventoryConfigLabel,
  transactionsFromReferenceMode,
  locationSelectionFromMode,
  validateInventoryWizardStep,
  type InventoryWizardStepId,
} from "@/lib/inventory/inventory-module-config";
import {
  validatePurchasingWizardStep,
  type PurchasingWizardStepId,
} from "@/lib/purchasing/purchasing-module-config";
import type { MergedInventorySettings } from "@/lib/inventory/register-form-config";
import { effectiveInputType, settingsPayloadFromMerged } from "@/lib/inventory/register-form-config";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type SetupStepId = InventoryWizardStepId | PurchasingWizardStepId | "Welcome" | "Register form" | "Review";

const STEPS: SetupStepId[] = [
  "Welcome",
  "Inventory Structure",
  "Storage Locations",
  "Procurement Workflow",
  "Procurement Terminology",
  "Transaction References",
  "Approval Workflow",
  "Purchasing — How you buy",
  "Purchasing — Vendors",
  "Purchasing — Receipts",
  "Purchasing — Exports",
  "Purchasing — Module name",
  "Register form",
  "Review",
];

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2 text-sm font-semibold",
);

type Props = {
  open: boolean;
  busy?: boolean;
  draft: MergedInventorySettings;
  onDraftChange: (next: MergedInventorySettings) => void;
  onComplete: (settings: MergedInventorySettings) => void | Promise<void>;
  onSkip: () => void;
};

function applyInventoryConfig(draft: MergedInventorySettings): MergedInventorySettings {
  const inv = draft.inventory;
  const transactions = {
    ...transactionsFromReferenceMode(inv.reference_mode, draft.transactions),
    enable_location_selection: locationSelectionFromMode(inv.location_mode),
  };
  return { ...draft, transactions };
}

export function InventorySetupWizard({ open, busy, draft, onDraftChange, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<SetupStepId>("Welcome");
  const [stepError, setStepError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const enabledFields = draft.register_form.fields.filter((f) => f.enabled).sort((a, b) => a.order - b.order);
  const customFieldCount = enabledFields.filter((f) => f.is_custom).length;

  function goNext() {
    let err: string | null = null;
    if (step.startsWith("Purchasing")) {
      err = validatePurchasingWizardStep(step as PurchasingWizardStepId, draft.purchasing);
    } else if (step !== "Welcome" && step !== "Register form" && step !== "Review") {
      err = validateInventoryWizardStep(step as InventoryWizardStepId, draft.inventory);
    }
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    setStepError(null);
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function finish() {
    await onComplete(applyInventoryConfig({ ...draft, setup_completed: true }));
    setStep("Welcome");
    setStepError(null);
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: "Inventory Structure", value: inventoryConfigLabel("asset_types", draft.inventory.asset_types) },
    { label: "Location Structure", value: inventoryConfigLabel("location_mode", draft.inventory.location_mode) },
    { label: "Procurement Workflow", value: inventoryConfigLabel("procurement_mode", draft.inventory.procurement_mode) },
    {
      label: "Procurement Label",
      value: inventoryConfigLabel("procurement_action_label", draft.inventory.procurement_action_label),
    },
    { label: "Transaction References", value: inventoryConfigLabel("reference_mode", draft.inventory.reference_mode) },
    { label: "Approval Workflow", value: inventoryConfigLabel("approval_mode", draft.inventory.approval_mode) },
    {
      label: "Purchasing",
      value: [
        draft.purchasing.enable_replenishment_requests ? draft.purchasing.replenishment_label : null,
        draft.purchasing.enable_quick_purchases ? "Quick purchases" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
    },
    { label: "Vendor tracking", value: draft.purchasing.enable_vendor_tracking ? "Yes" : "No" },
    { label: "Receipts", value: draft.purchasing.require_receipt_upload ? "Required" : "Optional" },
    {
      label: "Monthly exports",
      value: draft.purchasing.enable_monthly_expense_exports ? "Yes" : "No",
    },
    { label: "Module label", value: draft.purchasing.purchasing_label },
  ];

  return (
    <PremiumModal
      open={open}
      size="lg"
      className="max-w-3xl"
      title="Inventory setup"
      subtitle="Configure inventory behavior for your organization."
      onClose={onSkip}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn("h-2 w-2 rounded-full", i <= stepIndex ? "bg-ds-accent" : "bg-slate-200")}
                aria-hidden
              />
            ))}
            <span className="sr-only">
              Step {stepIndex + 1} of {STEPS.length}: {step}
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {step !== "Welcome" ? (
              <button type="button" className={SECONDARY} disabled={busy} onClick={goBack}>
                Back
              </button>
            ) : (
              <button type="button" className={SECONDARY} disabled={busy} onClick={onSkip}>
                Set up later
              </button>
            )}
            {step === "Review" ? (
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => void finish()}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Finish setup"
                )}
              </button>
            ) : (
              <button type="button" className={PRIMARY} disabled={busy} onClick={goNext}>
                Continue
              </button>
            )}
          </div>
        </div>
      }
    >
      {stepError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {stepError}
        </p>
      ) : null}

      {step === "Welcome" ? (
        <div className="space-y-4 text-sm text-ds-foreground">
          <p>
            Configure how your team tracks stock, locations, procurement, and transactions. These choices apply to your
            whole organization — not individual sites.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ds-muted">
            <li>Choose asset types and storage structure</li>
            <li>Set procurement workflow and labels</li>
            <li>Define transaction references and approvals</li>
            <li>Customize the register item form</li>
          </ul>
          <p className="text-ds-muted">You can re-run this wizard anytime from Inventory settings.</p>
        </div>
      ) : null}

      {step === "Inventory Structure" ? (
        <InventoryStructureStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Storage Locations" ? (
        <StorageLocationsStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Procurement Workflow" ? (
        <ProcurementWorkflowStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Procurement Terminology" ? (
        <ProcurementTerminologyStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Transaction References" ? (
        <TransactionReferencesStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Approval Workflow" ? (
        <ApprovalWorkflowStep value={draft.inventory} onChange={(inventory) => onDraftChange(applyInventoryConfig({ ...draft, inventory }))} />
      ) : null}

      {step === "Purchasing — How you buy" ? (
        <PurchasingHowYouBuyStep
          value={draft.purchasing}
          onChange={(purchasing) => onDraftChange({ ...draft, purchasing })}
        />
      ) : null}
      {step === "Purchasing — Vendors" ? (
        <PurchasingVendorsStep value={draft.purchasing} onChange={(purchasing) => onDraftChange({ ...draft, purchasing })} />
      ) : null}
      {step === "Purchasing — Receipts" ? (
        <PurchasingReceiptsStep value={draft.purchasing} onChange={(purchasing) => onDraftChange({ ...draft, purchasing })} />
      ) : null}
      {step === "Purchasing — Exports" ? (
        <PurchasingExportsStep value={draft.purchasing} onChange={(purchasing) => onDraftChange({ ...draft, purchasing })} />
      ) : null}
      {step === "Purchasing — Module name" ? (
        <PurchasingModuleNameStep value={draft.purchasing} onChange={(purchasing) => onDraftChange({ ...draft, purchasing })} />
      ) : null}

      {step === "Register form" ? (
        <InventoryRegisterFieldsEditor
          registerForm={draft.register_form}
          onChange={(register_form) => onDraftChange({ ...draft, register_form })}
        />
      ) : null}

      {step === "Review" ? (
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
            <p className="font-bold text-ds-foreground">Configuration summary</p>
            <dl className="mt-3 space-y-2">
              {summaryRows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ds-muted">{row.label}</dt>
                  <dd className="mt-0.5 font-medium text-ds-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
            <p className="font-bold text-ds-foreground">Register form</p>
            <p className="mt-1 text-ds-muted">
              {enabledFields.length} fields enabled
              {customFieldCount ? ` · ${customFieldCount} custom` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-ds-foreground">
              {enabledFields.map((f) => (
                <li key={f.id}>
                  {f.label}{" "}
                  <span className="text-ds-muted">({effectiveInputType(f).replace(/_/g, " ")})</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-ds-muted">Saving will mark inventory setup as complete for your organization.</p>
        </div>
      ) : null}
    </PremiumModal>
  );
}

export function mergedSettingsForSave(merged: MergedInventorySettings) {
  return settingsPayloadFromMerged(applyInventoryConfig(merged));
}
