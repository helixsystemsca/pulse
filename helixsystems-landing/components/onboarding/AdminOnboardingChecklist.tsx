"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { isApiMode } from "@/lib/api";
import {
  emitOnboardingMaybeUpdated,
  PULSE_ONBOARDING_UPDATED_EVENT,
  PULSE_SETUP_PROGRESS_UPDATED_EVENT,
} from "@/lib/onboarding-events";
import { fetchOnboarding, ONBOARDING_STEP_HREF, type OnboardingState } from "@/lib/onboardingService";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { sessionHasAnyRole } from "@/lib/pulse-roles";

const BANNER_DISMISS_KEY = "pulse_admin_setup_banner_dismissed";

/** Dashboard body uses `lg:grid-cols-12`; span full width like other rows. */
const DASHBOARD_GRID_ROW = "w-full min-w-0 lg:col-span-12";

type Phase = "active" | "celebrating" | "exiting" | "done";

export function AdminOnboardingChecklist() {
  const { session } = usePulseAuth();
  const [onb, setOnb] = useState<OnboardingState | null>(null);
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState<Phase>("active");
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const prevCompleteRef = useRef<boolean | null>(null);

  const tenantOk =
    isApiMode() && session && canAccessPulseTenantApis(session) && sessionHasAnyRole(session, "company_admin");

  const load = useCallback(async () => {
    if (!tenantOk) return;
    try {
      setError(false);
      const o = await fetchOnboarding();
      setOnb(o);
    } catch {
      setOnb(null);
      setError(true);
    }
  }, [tenantOk]);

  useEffect(() => {
    try {
      setBannerDismissed(typeof window !== "undefined" && localStorage.getItem(BANNER_DISMISS_KEY) === "1");
    } catch {
      setBannerDismissed(false);
    }
  }, []);

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
    const iv = window.setInterval(() => void load(), 55_000);
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
    if (window.location.hash !== "#admin-onboarding-checklist") return;
    window.requestAnimationFrame(() =>
      document.getElementById("admin-onboarding-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [onb]);

  useEffect(() => {
    if (!onb) return;
    const done = onb.org_onboarding_completed ?? onb.onboarding_completed;
    if (prevCompleteRef.current === null) {
      prevCompleteRef.current = done;
      setPhase(done ? "done" : "active");
      return;
    }
    if (prevCompleteRef.current === false && done) {
      setPhase("celebrating");
      const t1 = window.setTimeout(() => setPhase("exiting"), 2600);
      const t2 = window.setTimeout(() => setPhase("done"), 3300);
      prevCompleteRef.current = done;
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    prevCompleteRef.current = done;
    setPhase(done ? "done" : "active");
    return undefined;
  }, [onb]);

  if (!tenantOk) return null;
  if (error && !onb) return null;
  if (!onb) {
    return (
      <section
        id="admin-onboarding-checklist"
        className={`ds-card-elevated p-5 lg:p-6 ${DASHBOARD_GRID_ROW}`}
        aria-hidden
      >
        <p className="text-sm text-ds-muted">Loading setup…</p>
      </section>
    );
  }

  if (onb.onboarding_role !== "admin") return null;

  const doneCount = onb.completed_count;
  const totalCount = onb.total_count;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  const orgDone = onb.org_onboarding_completed ?? onb.onboarding_completed;

  if (phase === "done" && orgDone && !bannerDismissed) {
    return (
      <div
        className={`ds-card-primary flex flex-wrap items-center justify-between gap-3 border border-ds-border px-4 py-3 shadow-[var(--ds-shadow-card)] ${DASHBOARD_GRID_ROW}`}
      >
        <p className="text-sm font-semibold text-ds-success">Setup complete ✓</p>
        <button
          type="button"
          className="ds-btn-secondary px-3 py-1.5 text-xs"
          onClick={() => {
            try {
              localStorage.setItem(BANNER_DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setBannerDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (phase === "done" && orgDone) return null;

  const successLook = phase === "celebrating" || phase === "exiting";
  const cardAnim =
    phase === "celebrating" || phase === "exiting"
      ? "scale-[1.03] shadow-[0_0_28px_color-mix(in_srgb,var(--ds-success)_35%,transparent)] transition-[transform,box-shadow,opacity] duration-700 ease-out"
      : "scale-100 transition-[transform,box-shadow,opacity] duration-500 ease-out";

  const fadeExit = phase === "exiting" ? "pointer-events-none opacity-0 max-h-0 overflow-hidden py-0 border-0 p-0" : "";

  return (
    <section
      id="admin-onboarding-checklist"
      className={`ds-card-primary ${DASHBOARD_GRID_ROW} ${cardAnim} ${fadeExit} border border-ds-border p-5 lg:p-6 shadow-[var(--ds-shadow-card)] ${successLook ? "border-[color-mix(in_srgb,var(--ds-success)_55%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-primary))]" : ""}`}
      aria-labelledby="admin-onboarding-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="admin-onboarding-title" className="font-headline text-lg font-bold text-ds-foreground">
          {successLook && phase === "celebrating" ? "Your system is ready" : "Set up your system"}
        </h2>
        <p className="text-xs font-medium text-ds-muted">
          {doneCount} of {totalCount} completed
        </p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ds-secondary ring-1 ring-ds-border">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${successLook ? "bg-ds-success shadow-[0_0_12px_color-mix(in_srgb,var(--ds-success)_45%,transparent)]" : "bg-ds-success"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-5 space-y-1">
        {onb.steps.map((s) => {
          const href = s.href?.trim() || ONBOARDING_STEP_HREF[s.key] || "/overview";
          const ok = s.completed;
          return (
            <li key={s.key}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 transition-colors hover:border-ds-border hover:bg-ds-secondary ${
                  ok || successLook ? "text-ds-success" : "text-ds-foreground"
                }`}
                onClick={() => emitOnboardingMaybeUpdated()}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                  {ok || successLook ? (
                    <Check className="h-5 w-5 text-ds-success" strokeWidth={2.25} />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-ds-border" />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{s.label}</span>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ds-muted">
                  {ok || successLook ? "Done" : "Open"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
