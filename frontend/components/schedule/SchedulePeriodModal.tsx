"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availDeadline, setAvailDeadline] = useState("");
  const [publishDeadline, setPublishDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const title = useMemo(() => (existing ? "Edit period" : "Create availability period"), [existing]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setSaving(false);
    setStartDate(existing?.start_date ?? "");
    setEndDate(existing?.end_date ?? "");
    setAvailDeadline(isoDateOnly(existing?.availability_deadline));
    setPublishDeadline(isoDateOnly(existing?.publish_deadline));
  }, [open, existing]);

  if (!open) return null;

  const save = async () => {
    if (!startDate || !endDate) {
      setErr("Start and end dates are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const json = {
        start_date: startDate,
        end_date: endDate,
        availability_deadline: availDeadline ? `${availDeadline}T23:59:00Z` : null,
        publish_deadline: publishDeadline ? `${publishDeadline}T23:59:00Z` : null,
        status: "open",
      };

      if (existing) {
        await apiFetch(`/api/v1/pulse/schedule/periods/${existing.id}`, { method: "PATCH", json });
      } else {
        await apiFetch(`/api/v1/pulse/schedule/periods`, { method: "POST", json });
      }
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save period");
    } finally {
      setSaving(false);
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
    type: "date" | "text";
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start" type="date" value={startDate} onChange={setStartDate} />
          <Field label="Period end" type="date" value={endDate} onChange={setEndDate} />
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
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-md bg-ds-accent px-4 py-2 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : existing ? "Save changes" : "Create period"}
          </button>
        </div>
      </div>
    </div>
  );
}

