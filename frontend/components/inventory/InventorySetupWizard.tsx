"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { InventoryCategoryEditor } from "@/components/inventory/InventoryCategoryEditor";
import { InventoryRegisterFieldsEditor } from "@/components/inventory/InventoryRegisterFieldsEditor";
import type { MergedInventorySettings } from "@/lib/inventory/register-form-config";
import { settingsPayloadFromMerged } from "@/lib/inventory/register-form-config";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const STEPS = ["Welcome", "Categories", "Register form", "Review"] as const;
type Step = (typeof STEPS)[number];

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

export function InventorySetupWizard({ open, busy, draft, onDraftChange, onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>("Welcome");

  const stepIndex = STEPS.indexOf(step);
  const categoryNames = useMemo(
    () => draft.categories.map((c) => c.name.trim()).filter(Boolean),
    [draft.categories],
  );
  const enabledFieldCount = draft.register_form.fields.filter((f) => f.enabled).length;

  function goNext() {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function finish() {
    await onComplete({ ...draft, setup_completed: true });
    setStep("Welcome");
  }

  return (
    <PremiumModal
      open={open}
      size="lg"
      className="max-w-3xl"
      title="Inventory setup"
      subtitle="Configure categories and the register item form for your team."
      onClose={onSkip}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-2 w-2 rounded-full",
                  i <= stepIndex ? "bg-ds-accent" : "bg-slate-200",
                )}
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
      {step === "Welcome" ? (
        <div className="space-y-4 text-sm text-ds-foreground">
          <p>
            Before your team registers stock, define how inventory is organized — category names, dropdown options,
            and which fields appear when adding an item.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ds-muted">
            <li>Group items into categories with optional sub-types</li>
            <li>Show or hide fields like vendor, location, and min stock</li>
            <li>Rename labels to match your site vocabulary</li>
          </ul>
          <p className="text-ds-muted">You can change these anytime under Inventory settings.</p>
        </div>
      ) : null}

      {step === "Categories" ? (
        <InventoryCategoryEditor
          categories={draft.categories}
          onChange={(categories) => onDraftChange({ ...draft, categories })}
          compact
        />
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
            <p className="font-bold text-ds-foreground">Categories ({categoryNames.length})</p>
            <p className="mt-1 text-ds-muted">
              {categoryNames.length ? categoryNames.join(", ") : "No categories yet — add at least one."}
            </p>
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
            <p className="font-bold text-ds-foreground">Register form</p>
            <p className="mt-1 text-ds-muted">{enabledFieldCount} fields enabled</p>
            <ul className="mt-2 space-y-1 text-ds-foreground">
              {draft.register_form.fields
                .filter((f) => f.enabled)
                .sort((a, b) => a.order - b.order)
                .map((f) => (
                  <li key={f.id}>
                    {f.label} <span className="text-ds-muted">({f.id})</span>
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
  return settingsPayloadFromMerged({
    ...merged,
    categories: merged.categories
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        options: c.options.map((o) => o.trim()).filter(Boolean),
      }))
      .filter((c) => c.name.length > 0),
  });
}
