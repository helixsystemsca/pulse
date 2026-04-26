"use client";

/**
 * frontend/components/settings/SettingsGear.tsx
 * ════════════════════════════════════════════════════════════════════════════
 * Drop this anywhere in a module page header to give users a direct link
 * to that module's settings tab.
 *
 * Usage:
 *   import { SettingsGear } from "@/components/settings/SettingsGear";
 *
 *   // In your page header:
 *   <SettingsGear module="schedule" />
 *   <SettingsGear module="workRequests" label="Work request settings" />
 *   <SettingsGear module="automation" size="sm" />
 */

import { Settings } from "lucide-react";
import Link from "next/link";
import type { ConfigModule } from "@/lib/config/service";

type Props = {
  module:  ConfigModule;
  label?:  string;
  size?:   "sm" | "md";
  className?: string;
};

export function SettingsGear({ module, label, size = "md", className = "" }: Props) {
  const iconCls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Link
      href={`/settings?tab=${module}`}
      title={label ?? `${module} settings`}
      className={`inline-flex items-center gap-1.5 rounded-md border border-ds-border bg-ds-primary px-2 py-1 text-ds-muted hover:text-ds-foreground hover:bg-ds-interactive-hover transition-colors ${className}`}
    >
      <Settings className={iconCls} aria-hidden />
      {label && <span className="text-xs font-medium">{label}</span>}
    </Link>
  );
}
