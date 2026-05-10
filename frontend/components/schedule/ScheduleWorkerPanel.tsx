"use client";

import { ChevronDown, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { attachWorkerDragPreview, setWorkerDragData } from "@/lib/schedule/drag";
import type { EmploymentType, ScheduleDragSession, Shift, Worker } from "@/lib/schedule/types";

const GROUP_ORDER: EmploymentType[] = ["full_time", "regular_part_time", "part_time"];

const GROUP_LABEL: Record<EmploymentType, string> = {
  full_time: "Full time",
  regular_part_time: "Regular part time",
  part_time: "Auxiliary",
};

type Props = {
  workers: Worker[];
  rosterDragEnabled: boolean;
  dragSession: ScheduleDragSession | null;
  shifts: Shift[];
  onDragSessionStart: (session: ScheduleDragSession) => void;
  onDragSessionEnd: () => void;
};

function groupKey(w: Worker): EmploymentType {
  return w.employmentType ?? "part_time";
}

export function ScheduleWorkerPanel({
  workers,
  rosterDragEnabled,
  dragSession,
  shifts,
  onDragSessionStart,
  onDragSessionEnd,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUP_ORDER.map((k) => [k, true])),
  );

  const activeCertRequirements: string[] = useMemo(() => {
    if (!dragSession || dragSession.kind !== "shift") return [];
    const s = shifts.find((x) => x.id === dragSession.shiftId);
    return (s?.required_certifications ?? []).filter(Boolean) as string[];
  }, [dragSession, shifts]);

  function workerMeetsCerts(worker: Worker, required: string[]): boolean {
    if (!required.length) return true;
    const wc = new Set(worker.certifications ?? []);
    return required.every((c) => wc.has(c));
  }

  const grouped = useMemo(() => {
    const m = new Map<EmploymentType, Worker[]>();
    for (const k of GROUP_ORDER) m.set(k, []);
    for (const w of workers) {
      if (!w.active) continue;
      const g = groupKey(w);
      const list = m.get(g) ?? m.get("part_time")!;
      list.push(w);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return m;
  }, [workers]);

  return (
    <div className="rounded-md border border-pulseShell-border bg-pulseShell-surface shadow-[var(--pulse-shell-shadow)]">
      <div className="border-b border-pulseShell-border px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-ds-foreground">Workers</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-ds-muted">
          Drag someone onto the calendar to place a shift. Highlights show availability, certifications, and hour load.
        </p>
      </div>
      <div className="max-h-[min(52vh,28rem)] space-y-1 overflow-y-auto px-2 py-2">
        {GROUP_ORDER.map((key) => {
          const list = grouped.get(key) ?? [];
          if (list.length === 0) return null;
          const isOpen = open[key] !== false;
          return (
            <div key={key} className="rounded-lg border border-pulseShell-border/80 bg-pulseShell-elevated/60">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover/40"
                onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                aria-expanded={isOpen}
              >
                <span>{GROUP_LABEL[key]}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-ds-muted">
                  {list.length}
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isOpen ? (
                <ul className="space-y-1 border-t border-pulseShell-border/60 px-1.5 py-1.5">
                  {list.map((w) => {
                    const eligible = workerMeetsCerts(w, activeCertRequirements);
                    const wc = new Set(w.certifications ?? []);
                    const missingCerts = activeCertRequirements.filter((c) => !wc.has(c));
                    return (
                    <li key={w.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        draggable={rosterDragEnabled}
                        title={
                          !eligible && missingCerts.length
                            ? `Missing cert: ${missingCerts.join(", ")}`
                            : undefined
                        }
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] leading-tight text-ds-foreground ${
                          rosterDragEnabled
                            ? "cursor-grab border border-transparent bg-[color-mix(in_srgb,var(--ds-success)_8%,var(--ds-surface-primary))] hover:border-ds-border active:cursor-grabbing dark:bg-[color-mix(in_srgb,var(--ds-success)_10%,var(--ds-surface-secondary))]"
                            : "cursor-default opacity-60"
                        } ${!eligible ? "pointer-events-none opacity-40" : ""}`}
                        onDragStart={(e) => {
                          if (!rosterDragEnabled) {
                            e.preventDefault();
                            return;
                          }
                          setWorkerDragData(e.dataTransfer, { workerId: w.id });
                          attachWorkerDragPreview(e, w.name);
                          flushSync(() => onDragSessionStart({ kind: "worker", workerId: w.id }));
                        }}
                        onDragEnd={onDragSessionEnd}
                        onKeyDown={(e) => {
                          if (!rosterDragEnabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                          }
                        }}
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium">{w.name}</span>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
