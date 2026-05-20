"use client";

import { useState } from "react";
import { seedJuneAuxiliaryAvailabilityDev } from "@/lib/schedule/employee-availability-api";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

type Props = {
  onSeeded?: () => void;
};

export function ScheduleDevToolsPanel({ onSeeded }: Props) {
  const { session } = usePulseAuth();
  const isAdmin = sessionHasAnyRole(session, "company_admin", "manager");
  const isDev = process.env.NODE_ENV !== "production";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isDev || !isAdmin) return null;

  async function runSeed() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await seedJuneAuxiliaryAvailabilityDev();
      let msg = `Seeded ${res.entries_created} rows for ${res.employees_matched} workers (${res.execution_ms}ms). Wiped ${res.wiped_rows} prior seed rows.`;
      if (res.employees_missing.length) {
        msg += ` Missing roster: ${res.employees_missing.join(", ")}.`;
      }
      setMessage(msg);
      setConfirmOpen(false);
      onSeeded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  return (
  <>
    <div className="rounded-xl border border-dashed border-amber-400/50 bg-amber-50/40 p-4 dark:bg-amber-950/20">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100">
        Scheduling dev tools
      </p>
      <p className="mt-1 text-sm text-ds-muted">
        Loads June 2026 auxiliary availability for drag/drop testing. Does not create assigned shifts.
      </p>
      {message ? <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="mt-3">
        <button
          type="button"
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "text-sm")}
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          Seed June availability test data
        </button>
      </div>
    </div>
    {confirmOpen ? (
      <ConfirmSeedModal setConfirmOpen={setConfirmOpen} busy={busy} onRunSeed={runSeed} />
    ) : null}
  </>
  );
}

function ConfirmSeedModal({
  setConfirmOpen,
  busy,
  onRunSeed,
}: {
  setConfirmOpen: (v: boolean) => void;
  busy: boolean;
  onRunSeed: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-pulseShell-border bg-white p-5 shadow-xl dark:bg-slate-950">
        <h3 className="text-lg font-bold text-ds-foreground">Seed June availability?</h3>
        <p className="mt-2 text-sm text-ds-muted">
          Replaces development seed rows for June 2026 only. Assigned shifts are not modified.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={buttonVariants({ surface: "light", intent: "secondary" })}
            disabled={busy}
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonVariants({ surface: "light", intent: "accent" })}
            disabled={busy}
            onClick={onRunSeed}
          >
            {busy ? "Seeding…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
