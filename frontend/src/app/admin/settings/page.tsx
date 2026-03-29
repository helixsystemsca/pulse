"use client";

import { useEffect, useState } from "react";
import { FEATURE_LABELS } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const f = await apiFetch<Record<string, boolean>>("/api/v1/admin/features");
    setFlags(f);
  }

  useEffect(() => {
    load().catch((e: Error) => setMessage(e.message));
  }, []);

  async function toggle(key: string, enabled: boolean) {
    setMessage(null);
    try {
      await apiFetch("/api/v1/admin/features", {
        method: "POST",
        json: { module_key: key, enabled },
      });
      await load();
      window.dispatchEvent(new CustomEvent("oi-features-updated"));
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!flags) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ color: "var(--muted)", marginBottom: "1.25rem" }}>
        Feature flags control which modules are active for your tenant. Disabled modules return{" "}
        <span className="mono">403 feature_disabled</span> on their APIs.
      </p>
      {message && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{message}</p>}
      <div className="grid" style={{ gap: "0.75rem" }}>
        {Object.entries(flags).map(([key, on]) => (
          <div
            key={key}
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{FEATURE_LABELS[key] ?? key}</div>
              <div className="mono" style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                {key}
              </div>
            </div>
            <button type="button" className="btn" onClick={() => toggle(key, !on)}>
              {on ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
