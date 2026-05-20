"use client";

import { memo } from "react";
import { Circle, Group, Line } from "react-konva";
import { styleForConstraintType } from "@/modules/communications/advertising-mapper/geometry/constraint-styles";
import { pairsFromFlatPoints } from "@/modules/communications/advertising-mapper/geometry/polygon-math";
import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";

function inchesToPx(inches: number): number {
  return inches * BASE_PX_PER_INCH;
}

function flatToKonvaPoints(points: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push(inchesToPx(points[i]!));
    out.push(inchesToPx(points[i + 1]!));
  }
  return out;
}

type Props = {
  constraints: readonly ConstraintRegion[];
  draftPoints: readonly number[];
  cursorInches: { x: number; y: number } | null;
  selectedConstraintId: string | null;
  toolMode: PlannerToolMode;
  onSelectConstraint: (id: string) => void;
  onAnchorDrag: (constraintId: string, vertexIndex: number, x: number, y: number) => void;
};

function ConstraintLayerInner({
  constraints,
  draftPoints,
  cursorInches,
  selectedConstraintId,
  toolMode,
  onSelectConstraint,
  onAnchorDrag,
}: Props) {
  const editAnchors = toolMode === "select" && selectedConstraintId;

  return (
    <Group>
      {constraints.map((region) => {
        const style = styleForConstraintType(region.constraintType);
        const konvaPts = flatToKonvaPoints(region.points);
        const selected = region.id === selectedConstraintId;
        const listening = toolMode === "select" || toolMode === "inventory";

        return (
          <Group key={region.id}>
            <Line
              points={konvaPts}
              closed
              fill={style.fill}
              stroke={selected ? "var(--ds-accent)" : style.stroke}
              strokeWidth={selected ? 2 : style.strokeWidth}
              dash={style.dash}
              listening={listening}
              onClick={() => onSelectConstraint(region.id)}
              onTap={() => onSelectConstraint(region.id)}
            />
            {editAnchors && selected
              ? pairsFromFlatPoints(region.points).map((p, vertexIndex) => (
                  <Circle
                    key={`${region.id}-v-${vertexIndex}`}
                    x={inchesToPx(p.x)}
                    y={inchesToPx(p.y)}
                    radius={5}
                    fill="#fff"
                    stroke="var(--ds-accent)"
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => {
                      const node = e.target;
                      onAnchorDrag(region.id, vertexIndex, node.x() / BASE_PX_PER_INCH, node.y() / BASE_PX_PER_INCH);
                    }}
                    onDragEnd={(e) => {
                      const node = e.target;
                      onAnchorDrag(region.id, vertexIndex, node.x() / BASE_PX_PER_INCH, node.y() / BASE_PX_PER_INCH);
                    }}
                  />
                ))
              : null}
          </Group>
        );
      })}

      {draftPoints.length >= 2 ? (
        <Line
          points={flatToKonvaPoints(draftPoints)}
          stroke="var(--ds-accent)"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      ) : null}
      {draftPoints.length >= 2 && cursorInches ? (
        <Line
          points={[
            ...flatToKonvaPoints(draftPoints).slice(-2),
            inchesToPx(cursorInches.x),
            inchesToPx(cursorInches.y),
          ]}
          stroke="rgba(56, 189, 248, 0.8)"
          strokeWidth={1.5}
          dash={[4, 4]}
          listening={false}
        />
      ) : null}
      {draftPoints.length >= 2
        ? pairsFromFlatPoints(draftPoints).map((p, i) => (
            <Circle
              key={`draft-${i}`}
              x={inchesToPx(p.x)}
              y={inchesToPx(p.y)}
              radius={i === 0 ? 7 : 4}
              fill={i === 0 ? "var(--ds-accent)" : "#fff"}
              stroke="var(--ds-accent)"
              strokeWidth={2}
              listening={false}
            />
          ))
        : null}
    </Group>
  );
}

export const ConstraintLayer = memo(ConstraintLayerInner);
