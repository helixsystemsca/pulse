"use client";

import { useMemo } from "react";
import { GridLayout, verticalCompactor, type Layout } from "react-grid-layout";
import { applyTileSnapsToLayout, DASHBOARD_GRID_COLS, DASHBOARD_GRID_GAP_PX, DASHBOARD_GRID_ROW_HEIGHT_PX } from "@/lib/dashboard/tile-grid";

type DashboardGridProps = {
  layout: Layout;
  width: number;
  editMode: boolean;
  canEditLayout: boolean;
  isInteracting: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: (next: Layout) => void;
  onLayoutPreview: (next: Layout) => void;
  children: React.ReactNode;
};

/**
 * Centralized react-grid-layout wrapper — snapping, compaction, and grid tokens live here.
 */
export function DashboardGrid({
  layout,
  width,
  editMode,
  canEditLayout,
  isInteracting,
  onInteractionStart,
  onInteractionEnd,
  onLayoutPreview,
  children,
}: DashboardGridProps) {
  const dragCompactor = useMemo(
    () => ({
      type: null,
      allowOverlap: true,
      compact: (l: Layout) => l,
    }),
    [],
  );
  const stableCompactor = useMemo(() => verticalCompactor, []);
  const compactor = isInteracting ? dragCompactor : stableCompactor;

  const snap = (next: Layout, mode: "quantize" | "footprint") =>
    applyTileSnapsToLayout(next, DASHBOARD_GRID_COLS, width, mode);

  const finishInteraction = (next: Layout) => {
    const snapped = snap(next, "footprint");
    const compacted = stableCompactor.compact(snapped, DASHBOARD_GRID_COLS) as Layout;
    const finalLayout = snap(compacted, "footprint");
    onInteractionEnd(finalLayout);
  };

  return (
    <GridLayout
      layout={layout}
      width={width}
      gridConfig={{
        cols: DASHBOARD_GRID_COLS,
        rowHeight: DASHBOARD_GRID_ROW_HEIGHT_PX,
        margin: [DASHBOARD_GRID_GAP_PX, DASHBOARD_GRID_GAP_PX],
        containerPadding: [0, 0],
      }}
      dragConfig={{
        enabled: canEditLayout && editMode,
        bounded: false,
        cancel: "button, a, input, textarea, select, option, [role='button'], .dashboard-no-drag",
      }}
      resizeConfig={{
        enabled: canEditLayout && editMode,
        handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
      }}
      compactor={compactor}
      onDragStart={() => {
        if (!canEditLayout || !editMode) return;
        onInteractionStart();
      }}
      onResizeStart={() => {
        if (!canEditLayout || !editMode) return;
        onInteractionStart();
      }}
      onDrag={(next) => {
        if (!canEditLayout || !editMode) return;
        onLayoutPreview(next as Layout);
      }}
      onResize={(next) => {
        if (!canEditLayout || !editMode) return;
        onLayoutPreview(snap(next as Layout, "quantize"));
      }}
      onDragStop={(next) => {
        if (!canEditLayout || !editMode) return;
        finishInteraction(next as Layout);
      }}
      onResizeStop={(next) => {
        if (!canEditLayout || !editMode) return;
        finishInteraction(next as Layout);
      }}
    >
      {children}
    </GridLayout>
  );
}
