"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { apiFetch } from "@/lib/api";
import {
  boundsForScheduleMonth,
  defaultCreateScheduleMonth,
  isMayScheduleMonth,
  scheduleMonthFromStartDate,
} from "@/lib/schedule/period-utils";

export type SchedulePeriodLite = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  availability_deadline: string | null;
  publish_deadline: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: SchedulePeriodLite | null;
};

function isoDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function SchedulePeriodModal({ open, onClose, onSaved, existing }: Props) {
  const [periodMonth, setPeriodMonth] = useState("");
  const [availDeadline, setAvailDeadline] = useState("");
  const [publishDeadline, setPublishDeadline] = useState("");
  const { phase: submitPhase, run: runSubmit } = useAsyncSubmitPhase();
  const submitPending = submitPhase === "loading" || submitPhase === "success";
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => (existing ? "Edit period" : "Create availability period"), [existing]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPeriodMonth(
      existing?.start_date ? scheduleMonthFromStartDate(existing.start_date) : defaultCreateScheduleMonth(),
    );
    setAvailDeadline(isoDateOnly(existing?.availability_deadline));
    setPublishDeadline(isoDateOnly(existing?.publish_deadline));
  }, [open, existing]);

  if (!open) return null;

  const save = async () => {
    if (!periodMonth) {
      setErr("Select a period month.");
      return;
    }
    let start_date: string;
    let end_date: string;
    try {
      ({ start_date, end_date } = boundsForScheduleMonth(periodMonth));
    } catch {
      setErr("Invalid period month.");
      return;
    }

    setErr(null);
    try {
      await runSubmit(async () => {
        const json = {
          start_date,
          end_date,
          availability_deadline: availDeadline ? `${availDeadline}T23:59:00Z` : null,
          publish_deadline: publishDeadline ? `${publishDeadline}T23:59:00Z` : null,
        };

        if (existing) {
          await apiFetch(`/api/v1/pulse/schedule/periods/${existing.id}`, { method: "PATCH", json });
          if (isMayScheduleMonth(periodMonth) && existing.status !== "published") {
            await apiFetch(`/api/v1/pulse/schedule/periods/${existing.id}`, {
              method: "PATCH",
              json: { status: "published" },
            });
          }
        } else {
          const created = await apiFetch<SchedulePeriodLite>(`/api/v1/pulse/schedule/periods`, {
            method: "POST",
            json,
          });
          if (isMayScheduleMonth(periodMonth)) {
            await apiFetch(`/api/v1/pulse/schedule/periods/${created.id}`, {
              method: "PATCH",
              json: { status: "published" },
            });
          }
        }
        onSaved();
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save period");
    }
  };

  const Field = ({
    label,
    value,
    onChange,
    type,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type: "date" | "month";
  }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ds-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground focus:outline-none focus:ring-2 focus:ring-ds-accent"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md space-y-4 rounded-xl border border-ds-border bg-ds-primary p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ds-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="text-ds-muted hover:text-ds-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-ds-muted">Defines the scheduling period workers submit availability for.</p>

        <Field label="Period month" type="month" value={periodMonth} onChange={setPeriodMonth} />

        {isMayScheduleMonth(periodMonth) ? (
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            May periods are marked published so you can test shift assignments.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Availability deadline" type="date" value={availDeadline} onChange={setAvailDeadline} />
          <Field label="Publish deadline" type="date" value={publishDeadline} onChange={setPublishDeadline} />
        </div>

        {err ? <p className="text-xs text-red-500">{err}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-ds-border px-4 py-2 text-xs font-semibold text-ds-muted hover:text-ds-foreground"
          >
            Cancel
          </button>
          <AsyncSubmitButton
            phase={submitPhase}
            idleLabel={existing ? "Save changes" : "Create period"}
            loadingLabel="Saving"
            disabled={submitPending}
            onClick={() => void save()}
            className="rounded-md px-4 py-2 text-xs font-bold"
          />
        </div>
      </div>
    </div>
  );
}
