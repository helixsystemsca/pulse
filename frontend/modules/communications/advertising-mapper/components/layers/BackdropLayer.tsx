"use client";

import { memo, type ReactNode } from "react";
import { Group, Image as KonvaImage, Line, Rect } from "react-konva";
import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

type Props = {
  wall: FacilityWallPlan;
  widthPx: number;
  heightPx: number;
  showGrid: boolean;
  gridInches: number;
  image: HTMLImageElement | null;
};

function BackdropLayerInner({ wall, widthPx, heightPx, showGrid, gridInches, image }: Props) {
  const kind = wall.backdropKind;
  const gradient =
    kind === "arena"
      ? { top: "#3d4a5c", mid: "#2a3344", bottom: "#121820" }
      : kind === "concourse"
        ? { top: "#4a5568", mid: "#374151", bottom: "#1f2937" }
        : { top: "#52525b", mid: "#3f3f46", bottom: "#27272a" };

  const gridStep = gridInches * BASE_PX_PER_INCH;
  const gridLines: ReactNode[] = [];
  if (showGrid && !image) {
    for (let x = 0; x <= widthPx; x += gridStep) {
      gridLines.push(
        <Line key={`gx-${x}`} points={[x, 0, x, heightPx]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />,
      );
    }
    for (let y = 0; y <= heightPx; y += gridStep) {
      gridLines.push(
        <Line key={`gy-${y}`} points={[0, y, widthPx, y]} stroke="rgba(255,255,255,0.06)" strokeWidth={1} listening={false} />,
      );
    }
  }

  return (
    <Group listening={false}>
      {image ? (
        <KonvaImage image={image} width={widthPx} height={heightPx} listening={false} />
      ) : (
        <>
          <Rect
            width={widthPx}
            height={heightPx}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: 0, y: heightPx }}
            fillLinearGradientColorStops={[0, gradient.top, 0.45, gradient.mid, 1, gradient.bottom]}
          />
          {kind === "arena" ? (
            <Rect y={heightPx * 0.62} width={widthPx} height={heightPx * 0.38} fill="#0a0e14" opacity={0.85} listening={false} />
          ) : null}
          {gridLines}
        </>
      )}
      <Rect width={widthPx} height={heightPx} stroke="rgba(255,255,255,0.15)" strokeWidth={1} listening={false} />
    </Group>
  );
}

export const BackdropLayer = memo(BackdropLayerInner);
