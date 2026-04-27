"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";

type Period = {
  id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  availability_deadline?: string | null;
  publish_deadline?: string | null;
  status: string;
  created_at: string;
};

type Window = { start: number; end: number };
type Windows = Record<string, Window[]>;

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const FIELD =
  "w-full rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm text-ds-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ds-primary/40";

function minFromHhmm(s: string): number {
  const [h, m] = (s || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, h * 60 + m));
}

export default function MyAvailabilityPage() {
  const [ready, setReady] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [draft, setDraft] = useState<Record<string, { start: string; end: string; enabled: boolean }>>(() => {
    const base: Record<string, { start: string; end: string; enabled: boolean }> = {};
    for (const d of DAYS) base[d.key] = { start: "08:00", end: "16:00", enabled: d.key !== "saturday" && d.key !== "sunday" };
    return base;
  });

  useEffect(() => {
    if (!readSession()) {
      navigateToPulseLogin();
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const p = await apiFetch<Period[]>("/api/v1/pulse/schedule/periods");
        setPeriods(p);
        setPeriodId(p[0]?.id ?? "");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not load schedule periods.");
      }
    })();
  }, [ready]);

  const selected = useMemo(() => periods.find((p) => p.id === periodId) ?? null, [periodId, periods]);

  function toWindows(): Windows {
    const out: Windows = {};
    for (const d of DAYS) {
      const row = draft[d.key];
      if (!row || !row.enabled) {
        out[d.key] = [];
        continue;
      }
      out[d.key] = [{ start: minFromHhmm(row.start), end: minFromHhmm(row.end) }];
    }
    return out;
  }

  async function submit() {
    if (!periodId) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await apiFetch("/api/v1/pulse/schedule/availability", {
        method: "POST",
        json: {
          period_id: periodId,
          windows: toWindows(),
          exceptions: [],
        },
      });
      setOk("Availability submitted.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit availability.");
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    if (!periodId) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await apiFetch("/api/v1/pulse/schedule/acknowledge", {
        method: "POST",
        json: { period_id: periodId },
      });
      setOk("Acknowledged.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not acknowledge.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ds-foreground">My availability</h1>
          <p className="mt-1 text-sm text-ds-muted">Phase 2 (minimal). One window per weekday for now.</p>
        </div>
        <a href="/schedule" className="text-sm font-semibold text-ds-accent underline">
          Back to Schedule
        </a>
      </div>

      {err ? (
        <div className="mt-4 rounded-md border border-ds-danger/40 bg-ds-danger/10 px-3 py-2 text-sm text-ds-foreground">{err}</div>
      ) : null}
      {ok ? (
        <div className="mt-4 rounded-md border border-ds-success/40 bg-ds-success/10 px-3 py-2 text-sm text-ds-foreground">{ok}</div>
      ) : null}

      <div className="mt-6 rounded-md border border-pulseShell-border bg-pulseShell-surface p-4">
        <label className="text-xs font-semibold text-ds-muted">Schedule period</label>
        <select className={`${FIELD} mt-1.5`} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          <option value="">Select…</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.start_date} → {p.end_date} ({p.status})
            </option>
          ))}
        </select>
        {selected ? (
          <p className="mt-2 text-xs text-ds-muted">
            Availability deadline: {selected.availability_deadline ?? "—"} · Publish deadline: {selected.publish_deadline ?? "—"}
          </p>
        ) : null}
      </div>

      <div className="mt-6 rounded-md border border-pulseShell-border bg-pulseShell-surface p-4">
        <h2 className="text-sm font-semibold text-ds-foreground">Weekly windows</h2>
        <div className="mt-3 space-y-3">
          {DAYS.map((d) => {
            const row = draft[d.key]!;
            return (
              <div key={d.key} className="flex flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-sm text-ds-foreground">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => setDraft((s) => ({ ...s, [d.key]: { ...s[d.key]!, enabled: e.target.checked } }))}
                  />
                  {d.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className={FIELD}
                    value={row.start}
                    disabled={!row.enabled}
                    onChange={(e) => setDraft((s) => ({ ...s, [d.key]: { ...s[d.key]!, start: e.target.value } }))}
                  />
                  <span className="text-sm text-ds-muted">to</span>
                  <input
                    type="time"
                    className={FIELD}
                    value={row.end}
                    disabled={!row.enabled}
                    onChange={(e) => setDraft((s) => ({ ...s, [d.key]: { ...s[d.key]!, end: e.target.value } }))}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-pulseShell-border bg-ds-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={submit}
            disabled={busy || !periodId}
          >
            {busy ? "Submitting…" : "Submit availability"}
          </button>
          <button
            type="button"
            className="rounded-md border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-sm font-semibold text-ds-foreground disabled:opacity-60"
            onClick={acknowledge}
            disabled={busy || !periodId}
          >
            Acknowledge schedule (stub)
          </button>
          <a href="/schedule/availability-grid" className="text-sm font-semibold text-ds-accent underline">
            Supervisor view →
          </a>
        </div>
      </div>
    </div>
  );
}

