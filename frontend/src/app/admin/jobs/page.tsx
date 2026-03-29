"use client";

import { useEffect, useState } from "react";
import { useFeatureAccess } from "@/components/FeatureAccess";
import { apiFetch } from "@/lib/api";

type Job = {
  id: string;
  title: string;
  status: string;
  worker_id: string | null;
};

function jobBadge(status: string) {
  if (status === "active") return "admin-badge--ok";
  if (status === "completed") return "admin-badge--neutral";
  if (status === "cancelled") return "admin-badge--danger";
  return "admin-badge--warn";
}

export default function AdminJobsPage() {
  const { has, loaded } = useFeatureAccess();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !has("jobs")) return;
    apiFetch<Job[]>("/api/v1/jobs/")
      .then(setJobs)
      .catch((e: Error) => setErr(e.message));
  }, [loaded, has]);

  if (!loaded) {
    return <p style={{ color: "var(--muted)" }}>Loading…</p>;
  }

  if (!has("jobs")) {
    return (
      <p className="card" style={{ color: "var(--muted)" }}>
        Enable <strong>Jobs</strong> in Settings to track assignments here.
      </p>
    );
  }

  if (err) {
    return <p style={{ color: "var(--danger)" }}>{err}</p>;
  }

  return (
    <>
      <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
        Job queue with worker assignment. Link tools and inventory through the API or future job detail UI.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Worker</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  No jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr key={j.id}>
                  <td style={{ fontWeight: 500 }}>{j.title}</td>
                  <td>
                    <span className={`admin-badge ${jobBadge(j.status)}`}>{j.status}</span>
                  </td>
                  <td className="mono">
                    {j.worker_id ? `${j.worker_id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="mono">{j.id.slice(0, 8)}…</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
