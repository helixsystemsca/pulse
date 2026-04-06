"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CreateAction = "inspection" | "log";

const BTN =
  "inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-200/80 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] dark:hover:bg-[#1F2937]/50";

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
        <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={2} aria-hidden />
        Create
        <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 min-w-[11rem] rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#0F172A]"
            onClick={() => pick("inspection")}
          >
            New Inspection
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-[#0F172A]"
            onClick={() => pick("log")}
          >
            New Log
          </button>
        </div>
      ) : null}
    </div>
  );
}
