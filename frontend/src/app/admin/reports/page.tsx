"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

export default function AdminReportsPage() {
  const { has, loaded } = useFeatureAccess();
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !has("analytics")) return;
    (async () => {
      try {
        const s = await apiFetch<{ event_counts: Record<string, number> }>(
          "/api/v1/analytics/summary?days=30",
        );
        setSummary(s.event_counts);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Request failed");
      }
    })();
  }, [loaded, has]);

  if (!loaded) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (!has("analytics")) {
    return (
      <p className="card" style={{ color: "var(--muted)" }}>
        Enable <strong>Analytics</strong> in <Link href="/admin/settings">Settings</Link> to view event
        volume trends.
      </p>
    );
  }

  return (
    <>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Event volume by type (last 30 days) from the persisted audit log.
      </p>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      {!summary && !err && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {summary && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Event type</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <tr key={k}>
                    <td className="mono">{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
