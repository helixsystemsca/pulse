"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import {
  BlueprintReadOnlyCanvas,
  type BlueprintViewportHandle,
} from "@/components/zones-devices/BlueprintReadOnlyCanvas";
import type { BlueprintReadOnlyTheme } from "@/components/zones-devices/BlueprintReadOnlyCanvas";
import type { InfraAsset, InfraConnection, SystemType, TraceRouteResult } from "../utils/graphHelpers";
import type { AnnotateKind, AssetDrawShape, ConnectFlow, PrimaryMode } from "../mapBuilderTypes";
import { GraphOverlay } from "./GraphOverlay";
import { MapSemanticDrawLayer, type StageViewport } from "./MapSemanticDrawLayer";

export type MapSemanticHandlers = {
  viewport: StageViewport | null;
  disabled: boolean;
  primaryMode: PrimaryMode;
  assetShape: AssetDrawShape;
  connectFlow: ConnectFlow;
  annotateKind: AnnotateKind;
  onSemanticAssetShape: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticAssetShape"];
  onSemanticConnectionDraw: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticConnectionDraw"];
  onSemanticZonePolygon: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticZonePolygon"];
  onSemanticAnnotateSymbol: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticAnnotateSymbol"];
  onSemanticAnnotateText: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticAnnotateText"];
  onSemanticAnnotateSketch: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticAnnotateSketch"];
  onSemanticAnnotatePen: Parameters<typeof MapSemanticDrawLayer>[0]["onSemanticAnnotatePen"];
  drawConnectionSnapRadiusWorld?: number;
  allowedPrimaryModes?: ReadonlySet<PrimaryMode>;
  allowedAnnotateKinds?: ReadonlySet<AnnotateKind>;
};

export type { BlueprintViewportHandle };

type Props = {
  elements: BlueprintElement[];
  layers: BlueprintLayer[];
  theme: BlueprintReadOnlyTheme;
  /** Facility map base image (URL or data URL); drawn under overlays. */
  baseImageUrl?: string | null;
  /** World-space size for the base image (must match scaled image used on the server). */
  baseImageWorldSize?: { w: number; h: number } | null;
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

  dimForTrace?: boolean;
  /** When false, asset nodes are not draggable (semantic placement modes). */
  graphDraggableAssets?: boolean;
  /** Infrastructure Map Builder — semantic drawing on top of graph (ordered above GraphOverlay for hit capture). */
  mapSemantic?: MapSemanticHandlers | null;
  /** Lift Konva stage viewport (world-space rubber-band drawing). */
  onStageViewport?: (v: StageViewport) => void;
  directedConnections?: boolean;
  snapConnectPreviewToAssets?: boolean;
  /** Expand the Konva stage with the flex parent (fullscreen / kiosk). */
  sizeCanvasToContainer?: boolean;
  /** Pan tool: suspend graph hits so the stage can drag the view. */
  viewportPanActive?: boolean;
};

export const CanvasWrapper = forwardRef<BlueprintViewportHandle | null, Props>(function CanvasWrapper(
  {
    elements,
    layers,
    theme,
    baseImageUrl = null,
    baseImageWorldSize = null,
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
    graphDraggableAssets = true,
    mapSemantic = null,
    onStageViewport,
    directedConnections = false,
    snapConnectPreviewToAssets = true,
    sizeCanvasToContainer = false,
    viewportPanActive = false,
  },
  ref,
) {
  const [hoverAssetId, setHoverAssetId] = useState<string | null>(null);
  const [hoverConnectionId, setHoverConnectionId] = useState<string | null>(null);

  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const stageScaleRef = useRef<number>(1);

  const overlay = useMemo(() => {
    const graph = (
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
        draggableAssets={graphDraggableAssets && !connectMode}
        dimNonMatching={dimForTrace}
        directedConnections={directedConnections}
        snapConnectPreviewToAssets={snapConnectPreviewToAssets}
        pointerSuspended={viewportPanActive}
      />
    );

    const semantic =
      mapSemantic ? (
        <MapSemanticDrawLayer
          viewport={mapSemantic.viewport}
          assets={assets}
          disabled={mapSemantic.disabled}
          primaryMode={mapSemantic.primaryMode}
          assetShape={mapSemantic.assetShape}
          connectFlow={mapSemantic.connectFlow}
          annotateKind={mapSemantic.annotateKind}
          onSemanticAssetShape={mapSemantic.onSemanticAssetShape}
          onSemanticConnectionDraw={mapSemantic.onSemanticConnectionDraw}
          onSemanticZonePolygon={mapSemantic.onSemanticZonePolygon}
          onSemanticAnnotateSymbol={mapSemantic.onSemanticAnnotateSymbol}
          onSemanticAnnotateText={mapSemantic.onSemanticAnnotateText}
          onSemanticAnnotateSketch={mapSemantic.onSemanticAnnotateSketch}
          onSemanticAnnotatePen={mapSemantic.onSemanticAnnotatePen}
          drawConnectionSnapRadiusWorld={mapSemantic.drawConnectionSnapRadiusWorld}
          allowedPrimaryModes={mapSemantic.allowedPrimaryModes}
          allowedAnnotateKinds={mapSemantic.allowedAnnotateKinds}
        />
      ) : null;

    return (
      <>
        {graph}
        {semantic}
      </>
    );
  }, [
    activeSystems,
    assets,
    connections,
    connectDraftFromId,
    connectMode,
    dimForTrace,
    graphDraggableAssets,
    hoverAssetId,
    hoverConnectionId,
    mapSemantic,
    directedConnections,
    snapConnectPreviewToAssets,
    onAssetDragEnd,
    onAssetDragMove,
    onHoverAssetId,
    onHoverConnectionId,
    onSelectAssetId,
    onSelectConnectionId,
    selectedAssets,
    selectedConnections,
    traceResult,
    viewportPanActive,
  ]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onClick={() => {
        onCanvasClearSelection();
      }}
    >
      <BlueprintReadOnlyCanvas
        ref={ref}
        elements={elements}
        layers={layers}
        theme={theme}
        externalBaseImageUrl={baseImageUrl ?? undefined}
        externalBaseWorldSize={baseImageWorldSize ?? undefined}
        fitResetKey={fitResetKey}
        onSelectElementId={onPickBlueprintElementId}
        overlay={overlay}
        onPointerWorldMove={(p) => {
          pointerWorldRef.current = p;
        }}
        onStageScaleChange={(s) => {
          stageScaleRef.current = s;
        }}
        onStageViewport={onStageViewport}
        minHeight={720}
        sizeToContainer={sizeCanvasToContainer}
        chromeLess
        interactionMode={viewportPanActive ? "pan" : "default"}
      />
    </div>
  );
});
