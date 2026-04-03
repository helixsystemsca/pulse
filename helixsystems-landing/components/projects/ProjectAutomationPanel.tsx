"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { Card } from "@/components/pulse/Card";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  patchAutomationRule,
  type AutomationRuleRow,
} from "@/lib/projectsService";

const PRIMARY_BTN =
  "rounded-[10px] bg-[#2B4C7E] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#234066] disabled:opacity-50";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

function actionSummary(action: Record<string, unknown>): string {
  const t = String(action.type ?? "");
  if (t === "update_task") return `Update task (${String(action.target ?? "task")})`;
  if (t === "send_notification") return "Send notification";
  if (t === "auto_assign") return "Auto-assign user";
  return t || "—";
}

const TRIGGERS = [
  { value: "task_completed", label: "Task completed" },
  { value: "task_status_changed", label: "Task status changed" },
  { value: "task_overdue", label: "Task overdue (periodic scan)" },
  { value: "task_stale", label: "Task stale — no update 24h (periodic scan)" },
  { value: "proximity_missed", label: "Proximity missed (periodic scan)" },
] as const;

export function ProjectAutomationPanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<AutomationRuleRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [triggerType, setTriggerType] = useState<string>("task_completed");
  const [conditionStatus, setConditionStatus] = useState<string>("complete");
  const [actionType, setActionType] = useState<string>("update_task");
  const [actionTargetStatus, setActionTargetStatus] = useState<string>("todo");
  const [notifyTitle, setNotifyTitle] = useState("Automation");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

  const reload = useCallback(async () => {
    try {
      const r = await listAutomationRules(projectId);
      setRows(r);
      setErr(null);
    } catch {
      setErr("Could not load automation rules.");
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function submitRule() {
    const condition: Record<string, unknown> = {};
    if (conditionStatus.trim()) condition.status = conditionStatus.trim();

    let action: Record<string, unknown> = {};
    if (actionType === "update_task") {
      action = { type: "update_task", target: "next_task", fields: { status: actionTargetStatus } };
    } else if (actionType === "send_notification") {
      action = { type: "send_notification", title: notifyTitle.trim() || "Automation", message: notifyMessage.trim() };
    } else if (actionType === "auto_assign") {
      action = { type: "auto_assign", target: "next_task", user_id: assignUserId.trim() || undefined };
    }

    await createAutomationRule(projectId, {
      trigger_type: triggerType,
      condition_json: condition,
      action_json: action,
      is_active: true,
    });
    setDrawerOpen(false);
    await reload();
  }

  if (err) return <p className="text-sm font-medium text-red-700">{err}</p>;
  if (rows === null) return <p className="text-sm text-pulse-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-pulse-muted">
          Task rules run after a save. Overdue, stale, and proximity-missed rules are evaluated when a supervisor opens the Operations
          page (company scan).
        </p>
        <button type="button" className={PRIMARY_BTN} onClick={() => setDrawerOpen(true)}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New rule
          </span>
        </button>
      </div>

      {rows.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-pulse-muted">No automation rules yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} padding="md" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">{r.trigger_type.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-sm font-semibold text-pulse-navy">{actionSummary(r.action_json)}</p>
                  <p className="mt-0.5 text-xs text-pulse-muted">
                    Condition: {Object.keys(r.condition_json || {}).length ? JSON.stringify(r.condition_json) : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                    r.is_active
                      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80"
                      : "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80"
                  }`}
                  onClick={() =>
                    void (async () => {
                      await patchAutomationRule(projectId, r.id, { is_active: !r.is_active });
                      await reload();
                    })()
                  }
                >
                  {r.is_active ? "Active" : "Paused"}
                </button>
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 hover:text-red-800"
                  onClick={() =>
                    void (async () => {
                      await deleteAutomationRule(projectId, r.id);
                      await reload();
                    })()
                  }
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PulseDrawer
        open={drawerOpen}
        title="New automation rule"
        subtitle="Task triggers fire on save; scan triggers fire from Operations."
        onClose={() => setDrawerOpen(false)}
        labelledBy="automation-rule-title"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-pulse-muted hover:text-pulse-navy"
              onClick={() => setDrawerOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={() => void submitRule()}>
              Save rule
            </button>
          </div>
        }
      >
        <div className="mx-auto max-w-lg space-y-4">
          <div>
            <label className={LABEL} htmlFor="ar-trigger">
              Trigger
            </label>
            <select id="ar-trigger" className={FIELD} value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="ar-cond">
              Condition status (optional)
            </label>
            <input
              id="ar-cond"
              className={FIELD}
              placeholder="e.g. complete"
              value={conditionStatus}
              onChange={(e) => setConditionStatus(e.target.value)}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="ar-action">
              Action
            </label>
            <select id="ar-action" className={FIELD} value={actionType} onChange={(e) => setActionType(e.target.value)}>
              <option value="update_task">Update another task</option>
              <option value="send_notification">Send notification (event)</option>
              <option value="auto_assign">Auto-assign user (next task)</option>
            </select>
          </div>
          {actionType === "update_task" ? (
            <div>
              <label className={LABEL} htmlFor="ar-tstatus">
                Set dependent task status to
              </label>
              <select id="ar-tstatus" className={FIELD} value={actionTargetStatus} onChange={(e) => setActionTargetStatus(e.target.value)}>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
              </select>
              <p className="mt-1 text-xs text-pulse-muted">Applies to the next incomplete task that depends on the triggering task.</p>
            </div>
          ) : null}
          {actionType === "send_notification" ? (
            <>
              <div>
                <label className={LABEL} htmlFor="ar-ntitle">
                  Title
                </label>
                <input id="ar-ntitle" className={FIELD} value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="ar-nmsg">
                  Message
                </label>
                <textarea id="ar-nmsg" rows={2} className={FIELD} value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} />
              </div>
            </>
          ) : null}
          {actionType === "auto_assign" ? (
            <div>
              <label className={LABEL} htmlFor="ar-assign">
                User ID
              </label>
              <input id="ar-assign" className={FIELD} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} />
            </div>
          ) : null}
        </div>
      </PulseDrawer>
    </div>
  );
}
