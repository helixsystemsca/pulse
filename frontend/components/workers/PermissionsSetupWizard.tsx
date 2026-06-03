"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { InventoryDepartmentsPanel } from "@/components/inventory/InventoryDepartmentsPanel";
import { PremiumModal } from "@/components/ui/premium-modal";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import type { AsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { cn } from "@/lib/cn";
import type { TenantDepartmentRow } from "@/lib/tenantDepartmentsService";
import { buttonVariants } from "@/styles/button-variants";

const STEPS = ["Welcome", "Departments", "Review"] as const;
type Step = (typeof STEPS)[number];

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-4 py-2 text-sm font-semibold",
);

type Props = {
  open: boolean;
  busy?: boolean;
  submitPhase?: AsyncSubmitPhase;
  companyId: string | null;
  departments: TenantDepartmentRow[];
  onDepartmentsChange: (rows: TenantDepartmentRow[]) => void;
  canManageOrgData: boolean;
  orgDataBusy?: boolean;
  onOrgDataBusyChange?: (busy: boolean) => void;
  orgDataError?: string | null;
  onOrgDataError?: (message: string | null) => void;
  onComplete: () => void | Promise<void>;
  onSkip: () => void;
};

export function PermissionsSetupWizard({
  open,
  busy,
  submitPhase,
  companyId,
  departments,
  onDepartmentsChange,
  canManageOrgData,
  orgDataBusy,
  onOrgDataBusyChange,
  orgDataError,
  onOrgDataError,
  onComplete,
  onSkip,
}: Props) {
  const [step, setStep] = useState<Step>("Welcome");
  const [stepError, setStepError] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    if (step === "Departments" && departments.length === 0) {
      setStepError("Add at least one department for your organization.");
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
    await onComplete();
    setStep("Welcome");
    setStepError(null);
  }

  return (
    <PremiumModal
      open={open}
      onClose={onSkip}
      title="Permissions setup"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <button type="button" className={SECONDARY} disabled={busy} onClick={onSkip}>
            Skip for now
          </button>
          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <button type="button" className={SECONDARY} disabled={busy} onClick={goBack}>
                Back
              </button>
            ) : null}
            {step !== "Review" ? (
              <button type="button" className={PRIMARY} disabled={busy} onClick={goNext}>
                Continue
              </button>
            ) : submitPhase ? (
              <AsyncSubmitButton
                phase={submitPhase}
                idleLabel="Finish setup"
                loadingLabel="Saving…"
                successLabel="Saved"
                disabled={busy}
                onClick={() => void finish()}
              />
            ) : (
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
            Configure your organization&apos;s departments before assigning workers and module access. Departments drive
            the permissions matrix, worker profiles, and inventory partitions.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-ds-muted">
            <li>Add the departments that match how your site is organized</li>
            <li>Use clear names (e.g. Plant, Maintenance, Admin)</li>
            <li>Configure module access per department after setup</li>
          </ul>
          <p className="text-ds-muted">You can change departments later from Permissions settings.</p>
        </div>
      ) : null}

      {step === "Departments" ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-bold text-ds-foreground">Organization departments</h3>
            <p className="mt-1 text-sm text-ds-muted">
              These replace the legacy Panorama department list. Slugs are stable identifiers used on worker profiles
              and the access matrix.
            </p>
          </div>
          {orgDataError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {orgDataError}
            </p>
          ) : null}
          <InventoryDepartmentsPanel
            companyId={companyId}
            departments={departments}
            onDepartmentsChange={onDepartmentsChange}
            canManage={canManageOrgData}
            busy={orgDataBusy}
            onBusyChange={onOrgDataBusyChange}
            onError={onOrgDataError}
          />
        </div>
      ) : null}

      {step === "Review" ? (
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-base font-bold text-ds-foreground">Review</h3>
            <p className="mt-1 text-ds-muted">Confirm your department list before using the permissions matrix.</p>
          </div>
          <ul className="rounded-lg border border-ds-border bg-ds-secondary/20 px-4 py-3">
            {departments.length ? (
              departments.map((d) => (
                <li key={d.id} className="py-1 font-semibold text-ds-foreground">
                  {d.name}{" "}
                  <span className="font-mono text-xs font-normal text-ds-muted">({d.slug})</span>
                </li>
              ))
            ) : (
              <li className="text-ds-muted">No departments configured</li>
            )}
          </ul>
          <p className="text-xs text-ds-muted">
            After finishing, set each worker&apos;s department and role slot, then tune module access in the Permissions
            card.
          </p>
        </div>
      ) : null}
    </PremiumModal>
  );
}
