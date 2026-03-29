export default function AdminAlertsPage() {
  const items = [
    { id: "1", title: "Beacon offline", meta: "Zone 3 (Garage) · 12 min ago", severity: "warn" as const },
    { id: "2", title: "Low inventory: cutting tips", meta: "Inventory · 1h ago", severity: "warn" as const },
    { id: "3", title: "Work request overdue", meta: "WR-8755 · Life Safety Escalations", severity: "danger" as const },
  ];

  return (
    <>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Exceptions pushed from zones, assets, and work requests. Connect notification channels in Settings.
      </p>
      <div className="admin-panel">
        <div className="admin-panel-head">Recent alerts</div>
        <div className="admin-panel-body">
          {items.map((a) => (
            <div
              key={a.id}
              className={`admin-feed-item ${a.severity === "danger" ? "admin-feed-item--danger" : "admin-feed-item--warning"}`}
            >
              <div className="admin-feed-type">{a.title}</div>
              <div className="admin-feed-meta">{a.meta}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
