"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CreateAction = "inspection" | "log";

const BTN =
  "ds-btn-secondary inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold shadow-sm";

export function CreateDropdown({
  onNewInspection,
  onNewLog,
}: {
  onNewInspection: () => void;
  onNewLog: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function pick(action: CreateAction) {
    setOpen(false);
    if (action === "inspection") onNewInspection();
    else onNewLog();
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={BTN} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Plus className="h-4 w-4 text-ds-success" strokeWidth={2} aria-hidden />
        Create
        <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 min-w-[11rem] rounded-md border border-ds-border bg-ds-elevated py-1 shadow-[var(--ds-shadow-card)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
            onClick={() => pick("inspection")}
          >
            New Inspection
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
            onClick={() => pick("log")}
          >
            New Log
          </button>
        </div>
      ) : null}
    </div>
  );
}
