"use client";

import { memo } from "react";
import type Konva from "konva";
import { Group, Rect, Text, Transformer } from "react-konva";
import { blockStyleForStatus } from "@/modules/communications/advertising-mapper/lib/block-styles";
import { formatMeasurement } from "@/modules/communications/advertising-mapper/lib/measurements";
import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
import type { DimensionEditTarget, InventoryBlock, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";

type Props = {
  blocks: readonly InventoryBlock[];
  unit: MeasurementUnit;
  selectedId: string | null;
  draggable: boolean;
  violationIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, node: Konva.Group) => void;
  onTransformEnd: (id: string, node: Konva.Group) => void;
  onDimensionBadgeClick: (id: string, target: DimensionEditTarget) => void;
};

function InventoryLayerInner({
  blocks,
  unit,
  selectedId,
  draggable,
  violationIds,
  onSelect,
  onDragEnd,
  onTransformEnd,
  onDimensionBadgeClick,
}: Props) {
  return (
    <Group>
      {blocks.map((block) => {
        const style = blockStyleForStatus(block.status);
        const w = block.width_inches * BASE_PX_PER_INCH;
        const h = block.height_inches * BASE_PX_PER_INCH;
        const selected = block.id === selectedId;
        const violated = violationIds.has(block.id);

        return (
          <Group
            key={block.id}
            id={`block-${block.id}`}
            x={block.x * BASE_PX_PER_INCH}
            y={block.y * BASE_PX_PER_INCH}
            draggable={draggable}
            onClick={() => onSelect(block.id)}
            onTap={() => onSelect(block.id)}
            onDragEnd={(e) => onDragEnd(block.id, e.target as Konva.Group)}
            onTransformEnd={(e) => onTransformEnd(block.id, e.target as Konva.Group)}
          >
            <Rect
              width={w}
              height={h}
              fill={style.fill}
              stroke={violated ? "#ef4444" : selected ? "var(--ds-accent)" : style.stroke}
              strokeWidth={violated ? 3 : selected ? 2.5 : 1.5}
              cornerRadius={2}
            />
            <Rect x={8} y={8} width={Math.min(w - 16, 90)} height={16} fill={style.chipBg} cornerRadius={3} listening={false} />
            <Text x={12} y={10} text={style.label} fontSize={9} fontStyle="bold" fill="#fff" listening={false} />
            <Text x={8} y={28} text={block.name} fontSize={11} fontStyle="bold" fill="#f8fafc" width={w - 16} ellipsis listening={false} />
            <DimensionBadge x={w / 2} y={-10} label={formatMeasurement(block.width_inches, unit)} onClick={() => onDimensionBadgeClick(block.id, "width")} />
            <DimensionBadge x={-10} y={h / 2} label={formatMeasurement(block.height_inches, unit)} vertical onClick={() => onDimensionBadgeClick(block.id, "height")} />
          </Group>
        );
      })}
    </Group>
  );
}

function DimensionBadge({
  x,
  y,
  label,
  vertical,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  vertical?: boolean;
  onClick: () => void;
}) {
  const padX = 6;
  const padY = 3;
  const textW = label.length * 5.5 + padX * 2;
  const textH = 14 + padY * 2;
  const bw = vertical ? textH : textW;
  const bh = vertical ? textW : textH;

  return (
    <Group
      x={x - bw / 2}
      y={y - bh / 2}
      onClick={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onClick();
      }}
    >
      <Rect width={bw} height={bh} fill="rgba(15, 23, 42, 0.92)" stroke="var(--ds-accent)" strokeWidth={1} cornerRadius={4} />
      <Text x={padX} y={padY} text={label} fontSize={10} fontStyle="bold" fill="#e2e8f0" rotation={vertical ? -90 : 0} />
    </Group>
  );
}

export const InventoryLayer = memo(InventoryLayerInner);
export { Transformer as InventoryTransformer };
