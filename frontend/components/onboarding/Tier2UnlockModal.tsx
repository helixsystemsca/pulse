"use client";

import { useEffect, useState } from "react";
import { patchOnboarding } from "@/lib/onboardingService";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { useOnboarding } from "./OnboardingProvider";

const DISMISS_KEY = "pulse_onboarding_tier2_prompt_dismissed_v1";

export function Tier2UnlockModal() {
  const { state, reload } = useOnboarding();
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const show = Boolean(state?.tier2_eligible && !state?.tier2_enabled && !dismissed);
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[565] flex items-center justify-center p-4">
      <button
        type="button"
        className="ds-modal-backdrop absolute inset-0 backdrop-blur-[2px]"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
          setDismissed(true);
        }}
      />
      <div className="relative w-full max-w-md rounded-xl border border-ds-border bg-ds-primary p-6 shadow-[var(--ds-shadow-diffuse)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ds-muted">Tier 2</p>
        <h3 className="mt-1 text-xl font-bold text-ds-foreground">Unlock advanced features?</h3>
        <p className="mt-2 text-sm text-ds-muted">
          You completed Tier 1 onboarding (or reached the time unlock). Enable Tier 2 checklists now.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="ds-btn-secondary px-3 py-2 text-sm"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, "1");
              } catch {}
              setDismissed(true);
            }}
          >
            Later
          </button>
          <button
            type="button"
            className="ds-btn-solid-primary px-3 py-2 text-sm"
            disabled={busy}
            onClick={() =>
              void (async () => {
                setBusy(true);
                try {
                  await patchOnboarding({ tier2_enabled: true });
                  emitOnboardingMaybeUpdated();
                  await reload();
                } finally {
                  setBusy(false);
                }
              })()
            }
          >
            {busy ? "Unlocking..." : "Unlock Tier 2"}
          </button>
        </div>
      </div>
    </div>
  );
}

