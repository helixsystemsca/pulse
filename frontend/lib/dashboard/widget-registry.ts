import type { ReactNode } from "react";
import type { DashboardWidgetArchetype } from "@/lib/dashboard/archetypes";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";

export type DashboardWidgetSnapStrategy = "footprint" | "work-requests";

export type DashboardWidgetShellOptions = {
  jumpHref?: string;
  jumpLabel?: string;
  bodyClassName?: string;
  /** Workspace widgets minimize chrome. */
  chrome?: "standard" | "minimal";
};

export type DashboardWidgetDefinition = {
  id: string;
  title: string;
  archetype: DashboardWidgetArchetype;
  snapStrategy: DashboardWidgetSnapStrategy;
  shell?: DashboardWidgetShellOptions;
  render: (ctx: DashboardWidgetRenderContext) => ReactNode;
};
