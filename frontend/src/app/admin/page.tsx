"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { streamMetadata, useAdminRealtime } from "@/components/admin/AdminRealtimeProvider";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

type Overview = {
  tenant_id: string;
  counts: { tools: number; inventory_items: number; workers: number };
};

type ToolRow = {
  id: string;
  tag_id: string;
  name: string;
  status: string;
  zone_id: string | null;
  assigned_user_id: string | null;
};

export default function AdminOverviewPage() {
  const { has, loaded } = useFeatureAccess();
  const { alertItems, activityItems, getSeverity } = useAdminRealtime();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [toolsPreview, setToolsPreview] = useState<ToolRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const o = await apiFetch<Overview>("/api/v1/admin/overview");
        setOverview(o);
        if (has("tool_tracking")) {
          const t = await apiFetch<ToolRow[]>("/api/v1/tool-tracking/tools");
          setToolsPreview(t.slice(0, 5));
        } else setToolsPreview([]);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [loaded, has]);

  if (err) {
    return <p style={{ color: "var(--danger)" }}>{err}</p>;
  }

  if (!overview) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  return (
    <div>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem", maxWidth: 640 }}>
        Operations snapshot with real-time alerts and activity. Enable modules in{" "}
        <Link href="/admin/settings">Settings</Link> to unlock full fleet views.
      </p>

      <div className="admin-grid-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-label">Tools</div>
          <div className="admin-kpi-value">{overview.counts.tools}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Inventory SKUs</div>
          <div className="admin-kpi-value">{overview.counts.inventory_items}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Workers</div>
          <div className="admin-kpi-value">{overview.counts.workers}</div>
        </div>
        {has("analytics") ? (
          <Link href="/admin/reports" className="admin-kpi" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="admin-kpi-label">Analytics</div>
            <div className="admin-kpi-value" style={{ fontSize: "1rem", paddingTop: "0.35rem" }}>
              View trends →
            </div>
          </Link>
        ) : null}
      </div>

      <div className="admin-grid-two">
        <section className="admin-panel admin-col-5">
          <div className="admin-panel-head">
            <span>Alerts</span>
            <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              severity-coded
            </span>
          </div>
          <div className="admin-panel-body">
            {alertItems.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "0.5rem", margin: 0, fontSize: "0.88rem" }}>
                No alert-class events yet. Missing tools, low stock, and maintenance inference appear here
                in real time.
              </p>
            ) : (
              alertItems.map((ev, i) => {
                const sev = getSeverity(ev);
                return (
                  <div
                    key={`${ev.correlation_id ?? i}-${i}`}
                    className={`admin-feed-item admin-feed-item--${sev}`}
                  >
                    <div className="admin-feed-type">{ev.event_type}</div>
                    <div className="admin-feed-meta">{JSON.stringify(streamMetadata(ev))}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="admin-panel admin-col-7">
          <div className="admin-panel-head">
            <span>Activity</span>
            <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              live stream
            </span>
          </div>
          <div className="admin-panel-body">
            {activityItems.length === 0 ? (
              <p style={{ color: "var(--muted)", padding: "0.5rem", margin: 0, fontSize: "0.88rem" }}>
                Waiting for events…
              </p>
            ) : (
              activityItems.map((ev, i) => (
                <div key={`${ev.correlation_id ?? "ev"}-${i}`} className="admin-feed-item admin-feed-item--info">
                  <div className="admin-feed-type">{ev.event_type}</div>
                  <div className="admin-feed-meta">
                    {ev.entity_id ? `${ev.entity_id.slice(0, 8)}… · ` : ""}
                    {ev.source_module ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {has("tool_tracking") && toolsPreview.length > 0 ? (
        <>
          <h2 style={{ marginTop: "1.75rem", marginBottom: "0.75rem", fontSize: "1rem" }}>Tools preview</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tag</th>
                  <th>Status</th>
                  <th>Zone</th>
                </tr>
              </thead>
              <tbody>
                {toolsPreview.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="mono">{t.tag_id}</td>
                    <td>
                      <span
                        className={`admin-badge ${
                          t.status === "missing"
                            ? "admin-badge--danger"
                            : t.status === "assigned"
                              ? "admin-badge--ok"
                              : "admin-badge--neutral"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="mono">{t.zone_id ? `${t.zone_id.slice(0, 8)}…` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "0.75rem" }}>
            <Link href="/admin/tools">Full tools view →</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
