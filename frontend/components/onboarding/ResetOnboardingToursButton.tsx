"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";

import { useOnboardingTour } from "@/lib/onboarding/onboarding-tour-context";
import { resetAllOnboardingTours } from "@/lib/onboarding/tour-storage";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type ResetOnboardingToursButtonProps = {
  className?: string;
};

/**
 * Clears onboarding tour progress in the current browser (localStorage).
 * Use while signed in as the account that will demo the app.
 */
export function ResetOnboardingToursButton({ className }: ResetOnboardingToursButtonProps) {
  const tourCtx = useOnboardingTour();
  const [notice, setNotice] = useState<string | null>(null);

  const handleReset = useCallback(() => {
    if (tourCtx) {
      tourCtx.resetAllTours();
    } else {
      resetAllOnboardingTours();
    }
    setNotice(
      "Onboarding tours reset for this browser. Open Overview or another module to walk through tours again.",
    );
    window.setTimeout(() => setNotice(null), 6000);
  }, [tourCtx]);

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:items-end", className)}>
      <button
        type="button"
        className={cn(
          buttonVariants({ surface: "light", intent: "secondary" }),
          "inline-flex items-center gap-2 px-4 py-2.5",
        )}
        onClick={handleReset}
        title="Clear completed onboarding tours in this browser"
      >
        <RotateCcw className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Reset onboarding tours
      </button>
      {notice ? (
        <p
          role="status"
          className="max-w-sm rounded-lg border border-[color-mix(in_srgb,var(--ds-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--ds-accent)_8%,transparent)] px-3 py-2 text-left text-xs leading-snug text-ds-foreground sm:text-right"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
