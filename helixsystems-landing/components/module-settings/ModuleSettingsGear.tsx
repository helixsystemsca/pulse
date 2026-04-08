"use client";

import { Settings } from "lucide-react";
import { useState } from "react";
import type { ModuleId } from "@/lib/moduleSettings/defaults";
import { useModuleSettingsOptional } from "@/providers/ModuleSettingsProvider";
import { ModuleSettingsModal } from "./ModuleSettingsModal";

type Props = {
  moduleId: ModuleId;
  /** Accessible label, e.g. "Work requests organization settings" */
  label: string;
  className?: string;
};

/**
 * Admin-only gear control that opens the unified module settings modal.
 * Renders nothing if the app shell has no ModuleSettingsProvider.
 */
export function ModuleSettingsGear({ moduleId, label, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ctx = useModuleSettingsOptional();
  if (!ctx?.canConfigure) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center rounded-lg border border-slate-200/90 bg-white p-2.5 text-pulse-navy shadow-sm transition-colors hover:bg-slate-50 dark:border-ds-border dark:bg-ds-primary dark:text-slate-100 dark:hover:bg-ds-interactive-hover ${className}`.trim()}
        title={label}
        aria-label={label}
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>
      <ModuleSettingsModal moduleId={moduleId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
