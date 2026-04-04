export default function ZonesDevicesZonesPage() {
  return (
    <>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", maxWidth: "40rem" }}>
        Map physical areas to digital context for routing, proximity, and compliance. Zone geometry and
        anchors are managed alongside maintenance plans. Use the <strong>Blueprint</strong> tab to draw
        facility layouts and place devices.
      </p>
      <div className="card">
        <p style={{ margin: 0, color: "var(--text)" }}>
          Zone editor and floorplan overlays will connect to the tenant API. For now, coordinate zone
          labels with <strong>Maintenance</strong> and asset locations in <strong>Assets</strong>.
        </p>
      </div>
    </>
  );
}
