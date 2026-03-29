"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { WORK_REQUESTS_ANALYTICS, WORK_REQUESTS_SEED } from "@/lib/work-requests-data";
import type { WorkRequestPriority, WorkRequestStatus } from "@/types/cmms";

const PAGE_SIZE = 4;

function statusBadgeClass(s: WorkRequestStatus): string {
  if (s === "completed") return "admin-badge admin-badge--ok";
  if (s === "in_progress") return "admin-badge admin-badge--info";
  if (s === "overdue") return "admin-badge admin-badge--danger";
  return "admin-badge admin-badge--neutral";
}

function statusLabel(s: WorkRequestStatus): string {
  const map: Record<WorkRequestStatus, string> = {
    open: "Open",
    in_progress: "In Progress",
    completed: "Completed",
    overdue: "Overdue",
  };
  return map[s];
}

function priorityCell(p: WorkRequestPriority) {
  const base = "wr-priority-flag";
  if (p === "urgent") {
    return (
      <span className={`${base} is-urgent`} title="Urgent">
        ! Urgent
      </span>
    );
  }
  if (p === "high") return <span className={`${base} is-high`}>▲ High</span>;
  if (p === "medium") return <span className={`${base} is-medium`}>▲ Medium</span>;
  return <span className={`${base} is-low`}>◇ Low</span>;
}

function formatDue(iso: string, status: WorkRequestStatus): ReactNode {
  const d = new Date(iso + "T12:00:00");
  const out = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (status === "overdue") {
    return <span className="wr-due--danger">{out}</span>;
  }
  return out;
}

export default function WorkRequestsPage() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [priorityF, setPriorityF] = useState<string>("all");
  const [locationF, setLocationF] = useState<string>("all");
  const [dateF, setDateF] = useState<string>("all");
  const [page, setPage] = useState(1);

  const locations = useMemo(() => {
    const u = new Set(WORK_REQUESTS_SEED.map((r) => r.location));
    return Array.from(u).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return WORK_REQUESTS_SEED.filter((r) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (priorityF !== "all" && r.priority !== priorityF) return false;
      if (locationF !== "all" && r.location !== locationF) return false;
      if (dateF === "past_due") {
        const due = new Date(r.dueDate + "T12:00:00");
        if (due >= now) return false;
      }
      if (dateF === "this_week") {
        const due = new Date(r.dueDate + "T12:00:00");
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        if (due < now || due > end) return false;
      }
      if (!q) return true;
      const blob = `${r.asset.label} ${r.asset.id} ${r.description} ${r.location} ${r.id}`.toLowerCase();
      return blob.includes(q);
    });
  }, [search, statusF, priorityF, locationF, dateF]);

  const catalogTotal = WORK_REQUESTS_ANALYTICS.listTotal;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(filtered.length, safePage * PAGE_SIZE);

  const showCritical = () => {
    setStatusF("overdue");
    setPriorityF("urgent");
    setPage(1);
  };

  return (
    <>
      <div className="wr-page-head">
        <div className="wr-page-titles">
          <h2>Work Requests</h2>
          <p>Manage and monitor maintenance tasks across all zones.</p>
        </div>
        <button type="button" className="wr-btn-primary">
          + New Request
        </button>
      </div>

      <div className="wr-filter-bar">
        <div className="wr-filter-search">
          <label htmlFor="wr-search" className="sr-only">
            Search
          </label>
          <input
            id="wr-search"
            placeholder="Search assets, requests, locations…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="wr-filter-select">
          <label htmlFor="wr-status" className="sr-only">
            Status
          </label>
          <select
            id="wr-status"
            value={statusF}
            onChange={(e) => {
              setStatusF(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="wr-filter-select">
          <label htmlFor="wr-priority" className="sr-only">
            Priority
          </label>
          <select
            id="wr-priority"
            value={priorityF}
            onChange={(e) => {
              setPriorityF(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="wr-filter-select">
          <label htmlFor="wr-loc" className="sr-only">
            Location
          </label>
          <select
            id="wr-loc"
            value={locationF}
            onChange={(e) => {
              setLocationF(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div className="wr-filter-select">
          <label htmlFor="wr-date" className="sr-only">
            Date range
          </label>
          <select
            id="wr-date"
            value={dateF}
            onChange={(e) => {
              setDateF(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All dates</option>
            <option value="this_week">Due this week</option>
            <option value="past_due">Past due</option>
          </select>
        </div>
      </div>

      <div className="admin-table-wrap wr-table-wrap">
        <table className="admin-table wr-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Priority</th>
              <th>Asset &amp; ID</th>
              <th>Location</th>
              <th>Category</th>
              <th>Description</th>
              <th>Assigned To</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--muted)" }}>
                  No requests match these filters.
                </td>
              </tr>
            ) : (
              slice.map((r) => (
                <tr key={r.id} className="wr-row">
                  <td>
                    <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                  </td>
                  <td>{priorityCell(r.priority)}</td>
                  <td style={{ fontWeight: 500 }}>
                    {r.asset.label}
                    <div className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {r.asset.id}
                    </div>
                  </td>
                  <td>{r.location}</td>
                  <td>{r.category}</td>
                  <td className="wr-table-desc">{r.description}</td>
                  <td>
                    {r.assignedTo ? (
                      <span style={{ display: "inline-flex", alignItems: "center" }}>
                        <span className="wr-avatar">{r.assignedTo.initials}</span>
                        {r.assignedTo.name}
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Unassigned</span>
                    )}
                  </td>
                  <td>{formatDue(r.dueDate, r.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="wr-pagination">
        <span>
          Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{catalogTotal}</strong>{" "}
          requests
          <span style={{ marginLeft: "0.35rem", opacity: 0.85 }}>
            ({filtered.length} loaded in view{filtered.length !== catalogTotal ? ` · ${catalogTotal} in catalog` : ""})
          </span>
        </span>
        <div className="wr-pagination-nav">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            ←
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={n === safePage ? "is-current" : ""}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>

      <div className="wr-bottom-grid">
        <div className="wr-critical-banner">
          <div className="wr-critical-banner-icon">
            <span aria-hidden>⚠</span>
            <div>
              <h3>Overdue Critical Tasks</h3>
              <p>
                There are {WORK_REQUESTS_ANALYTICS.criticalCount} work requests that require immediate
                attention to prevent operational downtime.
              </p>
            </div>
          </div>
          <button type="button" className="wr-btn-danger" onClick={showCritical}>
            View Critical
          </button>
        </div>

        <aside className="wr-analytics-card">
          <h3>Analytics</h3>
          <div className="wr-analytics-metric">
            <div className="wr-analytics-metric-value">{WORK_REQUESTS_ANALYTICS.total.toLocaleString()}</div>
            <div className="wr-analytics-metric-label">Total requests (YTD)</div>
          </div>
          <div className="wr-analytics-metric">
            <div className="wr-analytics-metric-value" style={{ fontSize: "1.25rem" }}>
              {WORK_REQUESTS_ANALYTICS.avgCompletionDays} days
            </div>
            <div className="wr-analytics-metric-label">Avg completion time</div>
          </div>
          <div className="wr-analytics-insight">
            <strong>{WORK_REQUESTS_ANALYTICS.volumeInsight}</strong>
            <span>{WORK_REQUESTS_ANALYTICS.volumeDelta}</span>
          </div>
          <div className="wr-analytics-critical">
            <span className="wr-analytics-critical-count">
              Critical / overdue urgent: <em>{WORK_REQUESTS_ANALYTICS.criticalCount}</em>
            </span>
            <button type="button" className="wr-btn-primary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }} onClick={showCritical}>
              View Critical
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
