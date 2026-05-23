"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, ClipboardList, Palmtree } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  onOpenRequests: () => void;
  onOpenTimeOff: () => void;
  onOpenPreferences: () => void;
  disabled?: boolean;
  compact?: boolean;
};

/** Availability cluster — requests, time off, preferences (no overflow menu). */
export function ScheduleAvailabilityMenu({
  onOpenRequests,
  onOpenTimeOff,
  onOpenPreferences,
  disabled,
  compact,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          buttonVariants({ surface: "light", intent: "secondary" }),
          "inline-flex items-center gap-1.5 font-semibold",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
        )}
      >
        <CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
        Availability
        <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[11rem] rounded-lg border border-pulseShell-border bg-pulseShell-surface py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-950"
        >
          <MenuItem icon={ClipboardList} label="Requests" onClick={() => { onOpenRequests(); setOpen(false); }} />
          <MenuItem icon={Palmtree} label="Time off" onClick={() => { onOpenTimeOff(); setOpen(false); }} />
          <MenuItem icon={CalendarClock} label="Preferences" onClick={() => { onOpenPreferences(); setOpen(false); }} />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof CalendarClock;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {label}
    </button>
  );
}
