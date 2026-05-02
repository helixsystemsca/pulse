"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PULSE_PROXIMITY_EVENT, type PulseProximityDetail } from "@/lib/proximityBridge";
import { patchTask, postProximityEvent, type ProximityTask } from "@/lib/projectsService";
import { readSession } from "@/lib/pulse-session";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const BTN_SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2");
const BTN_PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2");

/** Gentle nudge after closing the sheet without starting a task (matches accountability "no action" window concept). */
const DISMISS_REMINDER_MS = 90_000;

function priorityBadge(p: string): string {
  if (p === "critical") return "bg-red-50 text-red-900 ring-1 ring-red-200/80";
  if (p === "high") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80";
  if (p === "low") return "bg-slate-100 text-pulse-muted ring-1 ring-slate-200/80";
  return "bg-sky-50 text-[#2B4C7E] ring-1 ring-sky-200/80";
}

/**
 * Listens for `pulse-proximity` events, calls POST /proximity/events, shows a bottom sheet with task suggestions.
 */
export function ProximityPromptHost() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [equipmentLabel, setEquipmentLabel] = useState("");
  const [tasks, setTasks] = useState<ProximityTask[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [proximityReminder, setProximityReminder] = useState<string | null>(null);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReminderSchedule = useCallback(() => {
    if (reminderTimerRef.current !== null) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
  }, []);

  const handleTag = useCallback(async (tag: string) => {
    const s = readSession();
    if (!s?.sub) return;
    try {
      const res = await postProximityEvent({
        user_id: s.sub,
        location_tag_id: tag,
        timestamp: new Date().toISOString(),
      });
      if (!res.tasks.length) return;
      clearReminderSchedule();
      setProximityReminder(null);
      setEquipmentLabel(res.equipment_label);
      setTasks(res.tasks);
      setOpen(true);
    } catch {
      /* BLE/gateway may be offline */
    }
  }, [clearReminderSchedule]);

  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<PulseProximityDetail>;
      const id = ce.detail?.locationTagId?.trim();
      if (id) void handleTag(id);
    };
    window.addEventListener(PULSE_PROXIMITY_EVENT, fn as EventListener);
    return () => window.removeEventListener(PULSE_PROXIMITY_EVENT, fn as EventListener);
  }, [handleTag]);

  useEffect(() => {
    if (!proximityReminder) return;
    const t = window.setTimeout(() => setProximityReminder(null), 6000);
    return () => window.clearTimeout(t);
  }, [proximityReminder]);

  useEffect(() => () => clearReminderSchedule(), [clearReminderSchedule]);

  function dismissPromptWithoutAction() {
    if (tasks.length && equipmentLabel.trim()) {
      clearReminderSchedule();
      reminderTimerRef.current = setTimeout(() => {
        setProximityReminder(`You have pending tasks at ${equipmentLabel.trim()}.`);
        reminderTimerRef.current = null;
      }, DISMISS_REMINDER_MS);
    }
    setOpen(false);
  }

  async function startTask(t: ProximityTask) {
    clearReminderSchedule();
    setProximityReminder(null);
    setBusy(t.id);
    try {
      await patchTask(t.id, { status: "in_progress" });
      setOpen(false);
      if (t.sop_id?.trim()) {
        router.push(`/sop/${encodeURIComponent(t.sop_id.trim())}`);
      }
    } catch {
      /* task patch handles validation */
    } finally {
      setBusy(null);
    }
  }

  function viewDetails(t: ProximityTask) {
    clearReminderSchedule();
    setProximityReminder(null);
    setOpen(false);
    router.push(`/projects/${t.project_id}`);
  }

  return (
    <>
      {proximityReminder && !open ? (
        <div
          className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[119] mx-auto max-w-lg px-4 sm:px-6"
          role="status"
        >
          <p className="rounded-md border border-amber-200/90 bg-amber-50/90 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm">
            {proximityReminder}
          </p>
        </div>
      ) : null}
      {!open ? null : (
    <div
      className="fixed inset-x-0 bottom-0 z-[120] max-h-[min(55vh,28rem)] overflow-y-auto border-t border-slate-200/90 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-sm"
      role="dialog"
      aria-label="Nearby tasks"
    >
      <div className="mx-auto max-w-lg px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-pulse-muted">Proximity</p>
            <p className="mt-1 font-headline text-base font-semibold text-pulse-navy">You are near {equipmentLabel}</p>
            <p className="mt-0.5 text-xs text-pulse-muted">Ready tasks matched to this location</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-pulse-muted transition-colors hover:bg-slate-100 hover:text-pulse-navy"
            aria-label="Dismiss"
            onClick={dismissPromptWithoutAction}
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-md border border-slate-200/90 bg-[#fafbfc] px-3 py-3 shadow-sm"
            >
              <p className="text-sm font-semibold text-pulse-navy">{t.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(t.priority)}`}>
                  {t.priority}
                </span>
                {t.due_date ? (
                  <span className="text-[11px] tabular-nums text-pulse-muted">Due {t.due_date}</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BTN_PRIMARY}
                  disabled={busy === t.id}
                  onClick={() => void startTask(t)}
                >
                  Start task
                </button>
                <button type="button" className={BTN_SECONDARY} onClick={() => viewDetails(t)}>
                  View details
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
      )}
    </>
  );
}
