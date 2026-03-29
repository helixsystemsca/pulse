"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { alertTitleAndBody, isWorkerAlertEvent, useWorkerStream } from "@/components/worker/WorkerStreamProvider";
import { apiFetch } from "@/lib/api";

type Me = { id: string; email: string };
type AssignedTool = {
  id: string;
  tag_id: string;
  name: string;
  status: string;
  zone_id: string | null;
};
type SiteMissing = { id: string; tag_id: string; name: string; assigned_user_id: string | null };

export default function WorkerHomePage() {
  const { has, loaded } = useFeatureAccess();
  const { status: streamStatus, lastEvent, tick } = useWorkerStream();

  const [me, setMe] = useState<Me | null>(null);
  const [assigned, setAssigned] = useState<AssignedTool[]>([]);
  const [siteMissing, setSiteMissing] = useState<SiteMissing[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushState, setPushState] = useState<NotificationPermission | "unsupported">("unsupported");

  const load = useCallback(async () => {
    if (!loaded || !has("tool_tracking")) {
      setAssigned([]);
      setSiteMissing([]);
      return;
    }
    try {
      const [user, tools, missing] = await Promise.all([
        apiFetch<Me>("/api/v1/auth/me"),
        apiFetch<AssignedTool[]>("/api/v1/tool-tracking/worker/tools"),
        apiFetch<SiteMissing[]>("/api/v1/tool-tracking/worker/missing"),
      ]);
      setMe(user);
      setAssigned(tools);
      setSiteMissing(missing);
    } catch {
      setAssigned([]);
      setSiteMissing([]);
    }
  }, [loaded, has]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushSupported(true);
      setPushState(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    const t = lastEvent.event_type.toLowerCase();
    if (
      t.includes("tool") ||
      t.includes("missing") ||
      t.includes("inventory") ||
      t.includes("maintenance")
    ) {
      void load();
    }
  }, [tick, lastEvent, load]);

  useEffect(() => {
    if (!lastEvent || !isWorkerAlertEvent(lastEvent)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const { title, body } = alertTitleAndBody(lastEvent);
    try {
      new Notification(title, { body, tag: `${lastEvent.event_type}-${lastEvent.correlation_id ?? tick}` });
    } catch {
      /* ignore */
    }
    try {
      navigator.vibrate?.(80);
    } catch {
      /* ignore */
    }
  }, [lastEvent, tick]);

  const assignedOk = useMemo(() => assigned.filter((x) => x.status !== "missing"), [assigned]);
  const assignedMissing = useMemo(() => assigned.filter((x) => x.status === "missing"), [assigned]);
  const otherMissing = useMemo(() => {
    if (!me) return siteMissing;
    return siteMissing.filter((m) => m.assigned_user_id !== me.id);
  }, [siteMissing, me]);

  async function enablePush() {
    if (!pushSupported) {
      setNote("Notifications not supported in this browser.");
      return;
    }
    const p = await Notification.requestPermission();
    setPushState(p);
    setNote(p === "granted" ? "Alerts on." : p === "denied" ? "Blocked in browser settings." : null);
  }

  async function acknowledge() {
    setNote(null);
    try {
      await apiFetch("/api/v1/core/ingest", {
        method: "POST",
        json: {
          event_type: "worker.acknowledged",
          payload: { action: "floor_confirm", at: new Date().toISOString() },
          source: "worker_app",
        },
      });
      setNote("Logged.");
      try {
        navigator.vibrate?.([40, 30, 40]);
      } catch {
        /* ignore */
      }
    } catch {
      setNote("Could not log — try again.");
    }
  }

  async function needHelp() {
    setNote(null);
    try {
      await apiFetch("/api/v1/core/ingest", {
        method: "POST",
        json: {
          event_type: "worker.help_requested",
          payload: { at: new Date().toISOString() },
          source: "worker_app",
        },
      });
      setNote("Supervisor notified (event logged).");
    } catch {
      setNote("Could not send.");
    }
  }

  if (!loaded) {
    return <p className="worker-hint">Loading…</p>;
  }

  const streamOk = streamStatus === "live";

  return (
    <>
      <header className="worker-header">
        <div>
          <h1>Floor</h1>
          <div className="worker-header-meta">Your tools · quick taps</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
          <span className="worker-live">
            <span className={`worker-dot ${streamOk ? "on" : streamStatus === "error" ? "err" : ""}`} />
            {streamOk ? "Live" : "…"}
          </span>
          <Link href="/admin" className="worker-admin-link">
            Admin
          </Link>
        </div>
      </header>

      {!has("tool_tracking") ? (
        <div className="worker-empty" style={{ marginTop: "1rem" }}>
          Tool tracking is off. Ask a lead to enable it in Admin → Settings.
        </div>
      ) : (
        <>
          <div className="worker-strip" role="status" aria-live="polite">
            <div className="worker-strip-cell">
              <div className="worker-strip-val ok">{assignedOk.length}</div>
              <div className="worker-strip-lbl">With you · OK</div>
            </div>
            <div className="worker-strip-cell">
              <div className={`worker-strip-val ${assignedMissing.length ? "bad" : "ok"}`}>
                {assignedMissing.length}
              </div>
              <div className="worker-strip-lbl">Yours · missing</div>
            </div>
            <div className="worker-strip-cell">
              <div className={`worker-strip-val ${otherMissing.length ? "warn" : "ok"}`}>
                {otherMissing.length}
              </div>
              <div className="worker-strip-lbl">Site · other</div>
            </div>
          </div>

          {assignedMissing.length > 0 ? (
            <section className="worker-section" aria-label="Your tools flagged missing">
              <h2 className="worker-section-title">Action · your tools missing</h2>
              {assignedMissing.map((t) => (
                <div key={t.id} className="worker-card bad">
                  <div className="worker-card-name">{t.name}</div>
                  <div className="worker-card-sub">
                    {t.tag_id}
                    {t.zone_id ? ` · zone ${t.zone_id.slice(0, 8)}…` : ""}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {assignedOk.length > 0 ? (
            <section className="worker-section" aria-label="Tools with you that are OK">
              <h2 className="worker-section-title">With you · OK</h2>
              {assignedOk.map((t) => (
                <div key={t.id} className="worker-card ok">
                  <div className="worker-card-name">{t.name}</div>
                  <div className="worker-card-sub">{t.tag_id}</div>
                </div>
              ))}
            </section>
          ) : assignedMissing.length === 0 ? (
            <div className="worker-empty">No tools assigned to you right now.</div>
          ) : null}

          {otherMissing.length > 0 ? (
            <section className="worker-section" aria-label="Other missing tools on site">
              <h2 className="worker-section-title">Elsewhere on site · missing</h2>
              {otherMissing.map((t) => (
                <div key={t.id} className="worker-card neutral">
                  <div className="worker-card-name">{t.name}</div>
                  <div className="worker-card-sub">{t.tag_id}</div>
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}

      <div className="worker-actions">
        {pushSupported ? (
          <button type="button" className="worker-btn worker-btn-primary" onClick={enablePush}>
            {pushState === "granted" ? "Alerts are on" : "Turn on push alerts"}
          </button>
        ) : (
          <p className="worker-hint">Use a browser with notifications for vibration + alerts.</p>
        )}

        <button type="button" className="worker-btn worker-btn-good" onClick={acknowledge}>
          Confirm — I’m caught up
        </button>

        <button type="button" className="worker-btn" onClick={needHelp}>
          Need help on floor
        </button>

        <button type="button" className="worker-btn" onClick={() => void load()}>
          Refresh lists
        </button>
      </div>

      {note ? <p className="worker-hint">{note}</p> : null}
    </>
  );
}
