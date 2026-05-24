"use client";

import type { CSSProperties, ReactNode } from "react";
import type { DashboardWidgetArchetype } from "@/lib/dashboard/archetypes";
import { OpsWidgetJumpLink } from "@/components/dashboard/widgets/ops/OpsWidgetJumpLink";
import {
  DASHBOARD_WIDGET_HEADER_HEIGHT_PX,
  DASHBOARD_WIDGET_PADDING_PX,
  DASHBOARD_WIDGET_RADIUS_PX,
} from "@/lib/dashboard/tokens";
import { cn } from "@/lib/cn";

export type BaseWidgetProps = {
  title: string;
  archetype?: DashboardWidgetArchetype;
  jumpHref?: string;
  jumpLabel?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  chrome?: "standard" | "minimal";
};

export function BaseWidget({
  title,
  archetype = "elastic",
  jumpHref,
  jumpLabel,
  headerRight,
  children,
  className,
  bodyClassName,
  chrome = "standard",
}: BaseWidgetProps) {
  const jumpAria = jumpLabel ?? `Open ${title}`;
  const minimal = chrome === "minimal" || archetype === "workspace";

  const tokenStyle: CSSProperties = {
    "--dash-widget-padding": `${DASHBOARD_WIDGET_PADDING_PX}px`,
    "--dash-widget-header-h": `${DASHBOARD_WIDGET_HEADER_HEIGHT_PX}px`,
    "--dash-widget-radius": `${DASHBOARD_WIDGET_RADIUS_PX}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "ops-dash-widget dash-base-widget flex h-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      data-widget-archetype={archetype}
      style={tokenStyle}
    >
      {!minimal ? (
        <div
          className="ops-dash-widget-header dash-base-widget-header flex shrink-0 items-center justify-between gap-1.5"
          style={{ minHeight: "var(--dash-widget-header-h)" }}
        >
          <p className="ops-widget-shell-title min-w-0 flex-1 truncate">{title}</p>
          <div className="flex shrink-0 items-center gap-1">
            {jumpHref ? <OpsWidgetJumpLink href={jumpHref} label={jumpAria} /> : null}
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        </div>
      ) : (
        <div className="sr-only">{title}</div>
      )}
      <div
        className={cn(
          "ops-dash-widget-body dash-base-widget-body min-h-0 flex-1 overflow-auto ds-scroll",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
