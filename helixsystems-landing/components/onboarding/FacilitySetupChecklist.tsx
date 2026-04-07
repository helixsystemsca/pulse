"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PULSE_SETUP_PROGRESS_UPDATED_EVENT } from "@/lib/onboarding-events";
import { fetchSetupProgress, type SetupProgressState } from "@/lib/onboardingService";
import { isApiMode } from "@/lib/api";
import { canAccessPulseTenantApis } from "@/lib/pulse-session";
import { usePulseAuth } from "@/hooks/usePulseAuth";

type RowDef = {
  id: string;
  label: string;
  href: string;
  done: (p: SetupProgressState) => boolean;
};

const ROWS: RowDef[] = [
  {
    id: "layout",
    label: "Facility layout created",
    href: "/zones-devices/blueprint",
    done: (p) => p.facility_layout_done,
  },
  {
    id: "zones",
    label: "Zones defined",
    href: "/dashboard/setup?tab=zones",
    done: (p) => p.zones_done,
  },
  {
    id: "equipment",
    label: "Equipment added",
    href: "/equipment",
    done: (p) => p.equipment_done,
  },
  {
    id: "workers",
    label: "Workers added",
    href: "/dashboard/workers",
    done: (p) => p.workers_done,
  },
  {
    id: "procedures",
    label: "First procedure created",
    href: "/projects",
    done: (p) => p.procedures_done,
  },
];

export function FacilitySetupChecklist() {
  const { session } = usePulseAuth();
  const [progress, setProgress] = useState<SetupProgressState | null>(null);
  const [error, setError] = useState(false);

  const tenantOk =
    isApiMode() && session && canAccessPulseTenantApis(session);

  const load = useCallback(async () => {
    if (!tenantOk) return;
    try {
      setError(false);
      const p = await fetchSetupProgress();
      setProgress(p);
    } catch {
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
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => {
      void load();
    }, 55_000);
    return () => {
      window.removeEventListener(PULSE_SETUP_PROGRESS_UPDATED_EVENT, onUpd);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [load]);

  useEffect(() => {
    if (!progress) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#facility-setup-checklist") return;
    window.requestAnimationFrame(() =>
      document.getElementById("facility-setup-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, [progress]);

  if (!tenantOk) return null;
  if (error && !progress) return null;
  if (!progress) {
    return (
      <section
        id="facility-setup-checklist"
        className="flex flex-col rounded-md border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] lg:col-span-12 lg:p-6 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        aria-hidden
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading setup checklist…</p>
      </section>
    );
  }

  const doneCount = ROWS.filter((r) => r.done(progress)).length;

  return (
    <section
      id="facility-setup-checklist"
      className="flex flex-col rounded-md border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] lg:col-span-12 lg:p-6 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      aria-labelledby="facility-setup-checklist-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="facility-setup-checklist-title" className="text-base font-bold text-gray-900 dark:text-gray-100">
          Get Your Facility Running
        </h3>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {doneCount} / {ROWS.length} complete
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Optional — jump in anywhere. Links open the right module.
      </p>
      <ul className="mt-4 space-y-1">
        {ROWS.map((r) => {
          const ok = r.done(progress);
          return (
            <li key={r.id}>
              <Link
                href={r.href}
                className={`flex items-center gap-3 rounded-md border border-transparent px-2 py-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-[#1F2937] dark:hover:bg-[#0B0F14] ${
                  ok ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                  {ok ? (
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                </span>
                <span className={`min-w-0 flex-1 text-sm font-medium ${ok ? "line-through decoration-gray-300 dark:decoration-gray-600" : ""}`}>
                  {r.label}
                </span>
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {ok ? "Done" : "To do"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
