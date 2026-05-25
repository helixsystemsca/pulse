"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { buildWorkspaceRenderContext, type DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import {
  HEIGHT_TIER_ORDER,
  moveEdgeWidgetColumn,
  moveWorkspaceWidget,
  setWorkspaceWidgetTier,
  type WidgetHeightTier,
  type WorkspaceColumnId,
  type WorkspaceLayout,
  type WorkspaceWidgetSlot,
  workspaceSlotHeightPx,
  widgetZoneClass,
} from "@/lib/dashboard/workspace-layout";
import { DASHBOARD_GRID_GAP_PX, DASHBOARD_LAYOUT_TRANSITION_MS } from "@/lib/dashboard/tokens";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

type WorkspaceDashboardProps = {
  layout: WorkspaceLayout;
  containerWidth: number;
  editMode: boolean;
  onLayoutChange: (next: WorkspaceLayout) => void;
  renderSlot: (
    slot: WorkspaceWidgetSlot,
    column: WorkspaceColumnId,
    ctx: DashboardWidgetRenderContext,
  ) => ReactNode;
};

const COLUMN_LABEL: Record<WorkspaceColumnId, string> = {
  left: "Operations rail",
  hero: "Primary workspace",
  right: "Support rail",
};

export function WorkspaceDashboard({
  layout,
  containerWidth,
  editMode,
  onLayoutChange,
  renderSlot,
}: WorkspaceDashboardProps) {
  return (
    <div
      className="dash-workspace grid min-h-0 min-w-0 w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-start"
      style={{ gap: DASHBOARD_GRID_GAP_PX, transitionDuration: `${DASHBOARD_LAYOUT_TRANSITION_MS}ms` }}
      data-dashboard-layout="workspace-3col"
    >
      {(["left", "hero", "right"] as const).map((column) => (
        <WorkspaceColumn
          key={column}
          column={column}
          slots={layout[column]}
          containerWidth={containerWidth}
          editMode={editMode}
          onLayoutChange={onLayoutChange}
          layout={layout}
          renderSlot={renderSlot}
        />
      ))}
    </div>
  );
}

function WorkspaceColumn({
  column,
  slots,
  containerWidth,
  editMode,
  layout,
  onLayoutChange,
  renderSlot,
}: {
  column: WorkspaceColumnId;
  slots: WorkspaceWidgetSlot[];
  containerWidth: number;
  editMode: boolean;
  layout: WorkspaceLayout;
  onLayoutChange: (next: WorkspaceLayout) => void;
  renderSlot: WorkspaceDashboardProps["renderSlot"];
}) {
  const zone = column === "hero" ? "hero" : "edge";

  return (
    <section
      className={cn(
        "dash-workspace-column flex min-h-0 min-w-0 flex-col",
        column === "hero" && "dash-workspace-column--hero",
        column !== "hero" && "dash-workspace-column--edge",
      )}
      data-workspace-column={column}
      aria-label={COLUMN_LABEL[column]}
    >
      {editMode ? (
        <p className="mb-1 shrink-0 px-0.5 text-[10px] font-bold uppercase tracking-wider text-pulse-muted">
          {COLUMN_LABEL[column]}
        </p>
      ) : null}
      <div className="flex flex-col" style={{ gap: DASHBOARD_GRID_GAP_PX }}>
        {slots.map((slot, index) => {
          const ctx = buildWorkspaceRenderContext(slot, column, containerWidth);
          return (
            <WorkspaceSlotShell
              key={slot.id}
              slot={slot}
              column={column}
              index={index}
              zone={zone}
              editMode={editMode}
              slotHeightPx={workspaceSlotHeightPx(slot, editMode)}
              toolbar={
                editMode ? (
                  <SlotEditToolbar
                    slot={slot}
                    column={column}
                    index={index}
                    layout={layout}
                    onLayoutChange={onLayoutChange}
                  />
                ) : null
              }
            >
              {renderSlot(slot, column, ctx)}
            </WorkspaceSlotShell>
          );
        })}
      </div>
    </section>
  );
}

function WorkspaceSlotShell({
  slot,
  column,
  zone,
  editMode,
  slotHeightPx,
  toolbar,
  children,
}: {
  slot: WorkspaceWidgetSlot;
  column: WorkspaceColumnId;
  index: number;
  zone: "hero" | "edge";
  editMode: boolean;
  slotHeightPx: number;
  toolbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "dash-workspace-slot flex shrink-0 flex-col overflow-hidden rounded-[var(--dash-widget-radius,12px)]",
        editMode && "ring-1 ring-ds-border/60",
      )}
      data-widget-id={slot.id}
      data-widget-zone={zone}
      data-widget-column={column}
      data-height-tier={slot.heightTier}
      style={{
        height: slotHeightPx,
        minHeight: slotHeightPx,
        maxHeight: slotHeightPx,
        transition: `height ${DASHBOARD_LAYOUT_TRANSITION_MS}ms ease, min-height ${DASHBOARD_LAYOUT_TRANSITION_MS}ms ease`,
      }}
    >
      {editMode ? (
        <div className="flex items-center gap-1 border-b border-ds-border/40 bg-ds-secondary/40 px-1 py-0.5">
          <GripVertical className="h-3 w-3 shrink-0 text-pulse-muted" aria-hidden />
          {toolbar}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function SlotEditToolbar({
  slot,
  column,
  index,
  layout,
  onLayoutChange,
}: {
  slot: WorkspaceWidgetSlot;
  column: WorkspaceColumnId;
  index: number;
  layout: WorkspaceLayout;
  onLayoutChange: (next: WorkspaceLayout) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        className="h-5 px-1"
        aria-label="Move up"
        onClick={() => onLayoutChange(moveWorkspaceWidget(layout, column, index, -1))}
      >
        <ChevronUp className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-5 px-1"
        aria-label="Move down"
        onClick={() => onLayoutChange(moveWorkspaceWidget(layout, column, index, 1))}
      >
        <ChevronDown className="h-3 w-3" />
      </Button>
      <select
        className="h-5 max-w-[5.5rem] rounded border border-ds-border bg-ds-primary px-1 text-[10px]"
        value={slot.heightTier}
        aria-label="Widget height"
        onChange={(e) =>
          onLayoutChange(setWorkspaceWidgetTier(layout, column, index, e.target.value as WidgetHeightTier))
        }
      >
        {HEIGHT_TIER_ORDER.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {widgetZoneClass(slot.id) === "edge" && (column === "left" || column === "right") ? (
        <Button
          type="button"
          variant="secondary"
          className="h-5 px-1.5 text-[10px]"
          onClick={() => onLayoutChange(moveEdgeWidgetColumn(layout, column, index))}
        >
          {column === "left" ? "→ Right" : "← Left"}
        </Button>
      ) : null}
    </div>
  );
}
