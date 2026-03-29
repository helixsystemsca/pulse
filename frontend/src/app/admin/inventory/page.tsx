"use client";

import { useEffect, useMemo, useState } from "react";
import { streamMetadata, useAdminRealtime } from "@/components/admin/AdminRealtimeProvider";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

type Item = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  low_stock: boolean;
};

export default function AdminInventoryPage() {
  const { has, loaded } = useFeatureAccess();
  const { events } = useAdminRealtime();
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !has("inventory")) return;
    apiFetch<Item[]>("/api/v1/inventory/items")
      .then(setItems)
      .catch((e: Error) => setErr(e.message));
  }, [loaded, has]);

  const recentLowStockEvents = useMemo(() => {
    return events
      .filter((e) => e.event_type === "inventory.low_stock" || streamMetadata(e).low_stock === true)
      .slice(0, 8);
  }, [events]);

  if (!loaded) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (!has("inventory")) {
    return (
      <p className="card" style={{ color: "var(--muted)" }}>
        Enable <strong>Inventory</strong> in Settings to view levels and alerts.
      </p>
    );
  }

  if (err) {
    return <p style={{ color: "var(--danger)" }}>{err}</p>;
  }

  const lowCount = items.filter((i) => i.low_stock).length;

  return (
    <>
      <div className="admin-grid-kpis" style={{ marginBottom: "1rem" }}>
        <div className="admin-kpi">
          <div className="admin-kpi-label">SKUs</div>
          <div className="admin-kpi-value">{items.length}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Low stock</div>
          <div className="admin-kpi-value" style={{ color: lowCount ? "var(--danger)" : undefined }}>
            {lowCount}
          </div>
        </div>
      </div>

      {recentLowStockEvents.length > 0 ? (
        <section className="admin-panel" style={{ marginBottom: "1rem" }}>
          <div className="admin-panel-head">Recent stock alerts (live)</div>
          <div className="admin-panel-body">
            {recentLowStockEvents.map((ev, i) => (
              <div key={`${ev.correlation_id}-${i}`} className="admin-feed-item admin-feed-item--danger">
                <div className="admin-feed-type">{ev.event_type}</div>
                <div className="admin-feed-meta">{JSON.stringify(streamMetadata(ev))}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Threshold</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)" }}>
                  No inventory lines.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.sku}</td>
                  <td>{r.name}</td>
                  <td>{r.quantity}</td>
                  <td>{r.unit}</td>
                  <td>{r.low_stock_threshold}</td>
                  <td>
                    {r.low_stock ? (
                      <span className="admin-badge admin-badge--danger">Low</span>
                    ) : (
                      <span className="admin-badge admin-badge--ok">OK</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
