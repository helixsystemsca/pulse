"use client";

import { useEffect, useState } from "react";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

type ToolRow = {
  id: string;
  tag_id: string;
  name: string;
  status: string;
  zone_id: string | null;
  assigned_user_id: string | null;
};

function statusBadge(status: string) {
  if (status === "missing") return "admin-badge--danger";
  if (status === "assigned") return "admin-badge--ok";
  if (status === "maintenance") return "admin-badge--warn";
  return "admin-badge--neutral";
}

export default function AdminToolsPage() {
  const { has, loaded } = useFeatureAccess();
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !has("tool_tracking")) return;
    apiFetch<ToolRow[]>("/api/v1/tool-tracking/tools")
      .then(setRows)
      .catch((e: Error) => setErr(e.message));
  }, [loaded, has]);

  if (!loaded) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (!has("tool_tracking")) {
    return (
      <p className="card" style={{ color: "var(--muted)" }}>
        Enable <strong>Tool tracking</strong> in Settings to manage tools here.
      </p>
    );
  }

  if (err) {
    return <p style={{ color: "var(--danger)" }}>{err}</p>;
  }

  return (
    <>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Status, zone location, and assigned worker per tag. Updates when zone events and assignments sync.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Tag</th>
              <th>Status</th>
              <th>Location (zone)</th>
              <th>Assigned worker</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  No tools registered.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="mono">{t.tag_id}</td>
                  <td>
                    <span className={`admin-badge ${statusBadge(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="mono">{t.zone_id ?? "—"}</td>
                  <td className="mono">
                    {t.assigned_user_id ? `${t.assigned_user_id.slice(0, 8)}…` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-cards-mobile" aria-hidden={rows.length === 0}>
        {rows.map((t) => (
          <div key={t.id} className="admin-tool-card">
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div className="mono" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {t.tag_id}
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <span className={`admin-badge ${statusBadge(t.status)}`}>{t.status}</span>
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
              Zone: <span className="mono">{t.zone_id ?? "—"}</span>
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              Worker:{" "}
              <span className="mono">{t.assigned_user_id ? `${t.assigned_user_id.slice(0, 8)}…` : "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
