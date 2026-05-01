"use client";

import { useMemo, useState } from "react";
import { Line } from "react-konva";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { BlueprintReadOnlyCanvas } from "@/components/zones-devices/BlueprintReadOnlyCanvas";
import type { BlueprintReadOnlyTheme } from "@/components/zones-devices/BlueprintReadOnlyCanvas";
import type { InfraAsset, InfraConnection, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import { GraphOverlay } from "./GraphOverlay";

type Props = {
  elements: BlueprintElement[];
  layers: BlueprintLayer[];
  theme: BlueprintReadOnlyTheme;
  fitResetKey?: string;

  assets: InfraAsset[];
  connections: InfraConnection[];
  activeSystems: Record<SystemType, boolean>;

  selectedAssetId: string | null;
  selectedConnectionId: string | null;
  traceResult: TraceRouteResult | null;

  connectMode: boolean;
  connectDraftFromId: string | null;
  connectPointerWorld: { x: number; y: number } | null;

  onPickBlueprintElementId?: (id: string) => void;
  onSelectAssetId: (id: string) => void;
  onSelectConnectionId: (id: string) => void;
  onCanvasClearSelection: () => void;
  onHoverAssetId?: (id: string | null) => void;
  onHoverConnectionId?: (id: string | null) => void;

  /** When true and traceResult exists, dim non-path items. */
  dimForTrace?: boolean;
};

export function CanvasWrapper({
  elements,
  layers,
  theme,
  fitResetKey,
  assets,
  connections,
  activeSystems,
  selectedAssetId,
  selectedConnectionId,
  traceResult,
  connectMode,
  connectDraftFromId,
  connectPointerWorld,
  onPickBlueprintElementId,
  onSelectAssetId,
  onSelectConnectionId,
  onCanvasClearSelection,
  onHoverAssetId,
  onHoverConnectionId,
  dimForTrace = false,
}: Props) {
  const [hoverAssetId, setHoverAssetId] = useState<string | null>(null);
  const [hoverConnectionId, setHoverConnectionId] = useState<string | null>(null);

  const overlay = useMemo(() => {
    return (
      <>
        <GraphOverlay
          assets={assets}
          connections={connections}
          activeSystems={activeSystems}
          selectedAssetId={selectedAssetId}
          selectedConnectionId={selectedConnectionId}
          hoverAssetId={hoverAssetId}
          hoverConnectionId={hoverConnectionId}
          traceResult={traceResult}
          onHoverAssetId={(id) => {
            setHoverAssetId(id);
            onHoverAssetId?.(id);
          }}
          onHoverConnectionId={(id) => {
            setHoverConnectionId(id);
            onHoverConnectionId?.(id);
          }}
          onSelectAssetId={onSelectAssetId}
          onSelectConnectionId={onSelectConnectionId}
          dimNonMatching={dimForTrace}
        />
        {/* Connection preview (simple straight line) */}
        {connectMode && connectDraftFromId && connectPointerWorld ? (() => {
          const from = assets.find((a) => a.id === connectDraftFromId);
          if (!from) return null;
          return (
            <Line
              points={[from.x, from.y, connectPointerWorld.x, connectPointerWorld.y]}
              stroke="rgba(59, 130, 246, 0.85)"
              strokeWidth={3}
              dash={[8, 6]}
              listening={false}
            />
          );
        })() : null}
      </>
    );
  }, [
    activeSystems,
    assets,
    connections,
    connectDraftFromId,
    connectMode,
    connectPointerWorld,
    dimForTrace,
    hoverAssetId,
    hoverConnectionId,
    onHoverAssetId,
    onHoverConnectionId,
    onSelectAssetId,
    onSelectConnectionId,
    selectedAssetId,
    selectedConnectionId,
    traceResult,
  ]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onClick={() => {
        onCanvasClearSelection();
      }}
    >
      <BlueprintReadOnlyCanvas
        elements={elements}
        layers={layers}
        theme={theme}
        fitResetKey={fitResetKey}
        onSelectElementId={onPickBlueprintElementId}
        overlay={overlay}
        minHeight={720}
      />
    </div>
  );
}

