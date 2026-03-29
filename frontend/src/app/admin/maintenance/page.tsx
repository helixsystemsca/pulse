"use client";

import { useEffect, useState } from "react";
import { streamMetadata, useAdminRealtime } from "@/components/admin/AdminRealtimeProvider";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

type Schedule = {
  id: string;
  name: string;
  tool_id: string | null;
  interval_days: number | null;
  usage_units_threshold: number | null;
  next_due_at: string | null;
};

type Log = {
  id: string;
  schedule_id: string | null;
  performed_at: string;
  confirmed_by: string | null;
  notes: string | null;
  inference_triggered: boolean;
};

export default function AdminMaintenancePage() {
  const { has, loaded } = useFeatureAccess();
  const { events } = useAdminRealtime();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !has("maintenance")) return;
    (async () => {
      try {
        const [s, l] = await Promise.all([
          apiFetch<Schedule[]>("/api/v1/maintenance/schedules"),
          apiFetch<Log[]>("/api/v1/maintenance/logs"),
        ]);
        setSchedules(s);
        setLogs(l.slice(0, 15));
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, [loaded, has]);

  const inferred = events.filter((e) => e.event_type.includes("maintenance_inferred")).slice(0, 6);

  if (!loaded) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (!has("maintenance")) {
    return (
      <p className="card" style={{ color: "var(--muted)" }}>
        Enable <strong>Maintenance</strong> in Settings for schedules and logs.
      </p>
    );
  }

  if (err) {
    return <p style={{ color: "var(--danger)" }}>{err}</p>;
  }

  return (
    <>
      <div className="admin-grid-two">
        <section className="admin-panel admin-col-7">
          <div className="admin-panel-head">Schedules</div>
          <div className="admin-panel-body" style={{ maxHeight: "none", padding: 0 }}>
            <div className="admin-table-wrap" style={{ border: "none", borderRadius: 0 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Next due</th>
                    <th>Tool</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ color: "var(--muted)" }}>
                        No schedules.
                      </td>
                    </tr>
                  ) : (
                    schedules.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td className="mono">{s.next_due_at ?? "—"}</td>
                        <td className="mono">{s.tool_id ? `${s.tool_id.slice(0, 8)}…` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-col-5">
          <div className="admin-panel-head">Inferred maintenance (live)</div>
          <div className="admin-panel-body">
            {inferred.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                No inference events in this session window.
              </p>
            ) : (
              inferred.map((ev, i) => (
                <div key={`${ev.correlation_id}-${i}`} className="admin-feed-item admin-feed-item--warning">
                  <div className="admin-feed-type">{ev.event_type}</div>
                  <div className="admin-feed-meta">{JSON.stringify(streamMetadata(ev))}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <h2 style={{ margin: "1.5rem 0 0.75rem", fontSize: "1rem" }}>Recent logs</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Schedule</th>
              <th>Inference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  No maintenance logs.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{l.performed_at}</td>
                  <td className="mono">{l.schedule_id ? `${l.schedule_id.slice(0, 8)}…` : "—"}</td>
                  <td>{l.inference_triggered ? "Yes" : "—"}</td>
                  <td>{l.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
