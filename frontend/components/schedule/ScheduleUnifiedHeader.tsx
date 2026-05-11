"use client";

import type { ReactNode } from "react";
import { SCHEDULE_BUILDER_HEADER_SHELL } from "./ScheduleBuilderHeader";

type Props = {
  sidebar: ReactNode;
  identity: ReactNode;
  actions: ReactNode;
  toolbar?: ReactNode | null;
};

/**
 * Single shell combining operations navigation, schedule identity/actions, and (when present) calendar toolbar.
 */
export function ScheduleUnifiedHeader({ sidebar, identity, actions, toolbar }: Props) {
  return (
    <header className={SCHEDULE_BUILDER_HEADER_SHELL}>
      <div className="flex flex-col gap-4 lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
          {sidebar}
          <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 max-w-2xl">{identity}</div>
            <div className="shrink-0 lg:self-start">{actions}</div>
          </div>
        </div>
        {toolbar ? (
          <div className="border-t border-pulseShell-border/70 pt-4 dark:border-slate-700/80">{toolbar}</div>
        ) : null}
      </div>
    </header>
  );
}
