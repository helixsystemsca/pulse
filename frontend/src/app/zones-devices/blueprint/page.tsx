"use client";

import dynamic from "next/dynamic";

const BlueprintDesigner = dynamic(
  () =>
    import("@/components/zones-devices/BlueprintDesigner").then((m) => ({
      default: m.BlueprintDesigner,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="bp-shell bp-shell--loading">
        <p className="bp-muted">Loading blueprint editor…</p>
      </div>
    ),
  },
);

export default function BlueprintPage() {
  return <BlueprintDesigner />;
}
