"use client";

import { Rect } from "react-konva";
import { BASE_PX_PER_INCH } from "@/modules/communications/advertising-mapper/lib/coordinates";
import type { WallSnipRect } from "@/modules/communications/advertising-mapper/lib/ad-snip";

type Props = {
  draft: WallSnipRect | null;
};

export function SnipDraftLayer({ draft }: Props) {
  if (!draft) return null;
  return (
    <Rect
      x={draft.x * BASE_PX_PER_INCH}
      y={draft.y * BASE_PX_PER_INCH}
      width={draft.width * BASE_PX_PER_INCH}
      height={draft.height * BASE_PX_PER_INCH}
      stroke="#0ea5e9"
      strokeWidth={2}
      dash={[8, 6]}
      fill="rgba(14, 165, 233, 0.15)"
      listening={false}
    />
  );
}
