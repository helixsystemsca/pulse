"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import {
  emitOnboardingMaybeUpdated,
  PULSE_ONBOARDING_UPDATED_EVENT,
  PULSE_SETUP_PROGRESS_UPDATED_EVENT,
} from "@/lib/onboarding-events";
import {
  fetchOnboarding,
  fetchSetupProgress,
  ONBOARDING_STEP_HREF,
  postOnboardingDemoData,
  type OnboardingState,
  type SetupProgressState,
} from "@/lib/onboardingService";
import { managerOrAbove } from "@/lib/pulse-roles";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";

function panelClass(): string {
  return "flex flex-col rounded-md border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-900 lg:col-span-12 lg:p-6 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]";
}

export function FacilitySetupChecklist() {
  const { session } = usePulseAuth();
  const [onb, setOnb] = useState<OnboardingState | null>(null);
  const [progress, setProgress] = useState<SetupProgressState | null>(null);
  const [error, setError] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const tenantOk =
    isApiMode() && session && canAccessPulseTenantApis(session) && managerOrAbove(session);

  const load = useCallback(async () => {
    if (!tenantOk) return;
    try {
      setError(false);
      const [o, p] = await Promise.all([fetchOnboarding(), fetchSetupProgress()]);
      setOnb(o);
      setProgress(p);
    } catch {
      setOnb(null);
      setProgress(null);
      setError(true);
    }
  }, [tenantOk]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpd = () => void load();
    window.addEventListener(PULSE_SETUP_PROGRESS_UPDATED_EVENT, onUpd);
    window.addEventListener(PULSE_ONBOARDING_UPDATED_EVENT, onUpd);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => {
      void load();
    }, 55_000);
    return () => {
      window.removeEventListener(PULSE_SETUP_PROGRESS_UPDATED_EVENT, onUpd);
      window.removeEventListener(PULSE_ONBOARDING_UPDATED_EVENT, onUpd);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [load]);

  useEffect(() => {
    if (!onb) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#facility-setup-checklist") return;
    window.requestAnimationFrame(() =>
      document.getElementById("facility-setup-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [onb]);

  const onDemo = async () => {
    setDemoBusy(true);
    try {
      await postOnboardingDemoData();
      await load();
      emitOnboardingMaybeUpdated();
    } catch {
      /* ignore */
    } finally {
      setDemoBusy(false);
    }
  };

  if (!tenantOk) return null;
  if (error && !onb) return null;
  if (!onb || onb.flow !== "manager") return null;

  const showDemoCta =
    progress != null &&
    !progress.devices_done &&
    !progress.onboarding_demo_sensors &&
    onb.steps.some((s) => s.key === "add_device" && !s.completed);

  const doneCount = onb.completed_count;
  const totalCount = onb.total_count;

  if (!progress) {
    return (
      <section id="facility-setup-checklist" className={panelClass()} aria-hidden>
        <p className="text-sm text-gray-500 dark:text-slate-400">Loading setup checklist…</p>
      </section>
    );
  }

  return (
    <section
      id="facility-setup-checklist"
      className={panelClass()}
      aria-labelledby="facility-setup-checklist-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="facility-setup-checklist-title" className="text-base font-bold text-gray-900 dark:text-slate-100">
          Get to your first insight
        </h3>
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
          {doneCount} / {totalCount} required complete
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
        Skippable anytime — progress stays on your dashboard. Each row opens the right screen.
      </p>

      {showDemoCta ? (
        <div className="mt-4 rounded-md border border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/80">
          <p className="text-sm text-pulse-navy dark:text-slate-200">
            No gateways yet? Load sample temperature sensors and charts without hardware.
          </p>
          <button
            type="button"
            disabled={demoBusy}
            onClick={() => void onDemo()}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {demoBusy ? "Working…" : "Use demo data"}
          </button>
        </div>
      ) : null}

      <ul className="mt-4 space-y-1">
        {onb.steps.map((s) => {
          const href = s.href?.trim() || ONBOARDING_STEP_HREF[s.key] || "/overview";
          const ok = s.completed;
          return (
            <li key={s.key}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-md border border-transparent px-2 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80 ${
                  ok ? "text-gray-500 dark:text-slate-400" : "text-gray-900 dark:text-slate-100"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                  {ok ? (
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-slate-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {s.label}
                  {s.optional ? (
                    <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Optional
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {ok ? "Done" : "Open"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
