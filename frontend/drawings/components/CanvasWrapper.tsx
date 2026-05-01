"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

  selectedAssets: string[];
  selectedConnections: string[];
  dimAssetIds?: Set<string>;
  dimConnectionIds?: Set<string>;
  traceResult: TraceRouteResult | null;

  connectMode: boolean;
  connectDraftFromId: string | null;

  onPickBlueprintElementId?: (id: string) => void;
  onSelectAssetId: (id: string, shiftKey: boolean) => void;
  onSelectConnectionId: (id: string, shiftKey: boolean) => void;
  onAssetDragMove?: (id: string, x: number, y: number) => void;
  onAssetDragEnd?: (id: string, x: number, y: number) => void;
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
  selectedAssets,
  selectedConnections,
  dimAssetIds,
  dimConnectionIds,
  traceResult,
  connectMode,
  connectDraftFromId,
  onPickBlueprintElementId,
  onSelectAssetId,
  onSelectConnectionId,
  onAssetDragMove,
  onAssetDragEnd,
  onCanvasClearSelection,
  onHoverAssetId,
  onHoverConnectionId,
  dimForTrace = false,
}: Props) {
  const [hoverAssetId, setHoverAssetId] = useState<string | null>(null);
  const [hoverConnectionId, setHoverConnectionId] = useState<string | null>(null);

  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const stageScaleRef = useRef<number>(1);

  const getPointerWorldPosition = useCallback(() => {
    return pointerWorldRef.current;
  }, []);

  const getStageScale = useCallback(() => {
    const s = stageScaleRef.current;
    return Number.isFinite(s) && s > 0 ? s : 1;
  }, []);

  const overlay = useMemo(() => {
    return (
      <GraphOverlay
        assets={assets}
        connections={connections}
        activeSystems={activeSystems}
        selectedAssets={selectedAssets}
        selectedConnections={selectedConnections}
        dimAssetIds={dimAssetIds}
        dimConnectionIds={dimConnectionIds}
        hoverAssetId={hoverAssetId}
        hoverConnectionId={hoverConnectionId}
        traceResult={traceResult}
        connectMode={connectMode}
        connectStartAssetId={connectDraftFromId}
        pointerWorldRef={pointerWorldRef}
        stageScaleRef={stageScaleRef}
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
        onAssetDragMove={onAssetDragMove}
        onAssetDragEnd={onAssetDragEnd}
        draggableAssets={!connectMode}
        dimNonMatching={dimForTrace}
      />
    );
  }, [
    activeSystems,
    assets,
    connections,
    connectDraftFromId,
    connectMode,
    dimForTrace,
    hoverAssetId,
    hoverConnectionId,
    onAssetDragEnd,
    onAssetDragMove,
    onHoverAssetId,
    onHoverConnectionId,
    onSelectAssetId,
    onSelectConnectionId,
    selectedAssets,
    selectedConnections,
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
        onPointerWorldMove={(p) => {
          pointerWorldRef.current = p;
        }}
        onStageScaleChange={(s) => {
          stageScaleRef.current = s;
        }}
        minHeight={720}
        chromeLess
      />
    </div>
  );
}

