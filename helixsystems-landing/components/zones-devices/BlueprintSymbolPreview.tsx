"use client";

import type { SymbolLibraryId } from "./blueprint-symbols-shared";

const STROKE = "rgba(226, 232, 240, 0.88)";
const FILL = "rgba(56, 189, 248, 0.14)";
const FILL2 = "rgba(34, 197, 94, 0.12)";
const SW = 1.25;

/** DOM SVG preview matching canvas {@link SymbolGlyph} styling (for library tiles). */
export function BlueprintSymbolPreview({
  symbolType,
  className,
  size = 36,
}: {
  symbolType: SymbolLibraryId | string;
  className?: string;
  size?: number;
}) {
  const k = String(symbolType).toLowerCase() as SymbolLibraryId | string;
  const vb = 22;
  const base = (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`${-vb} ${-vb} ${vb * 2} ${vb * 2}`}
      fill="none"
      aria-hidden
    >
      <g strokeLinecap="round" strokeLinejoin="round">
        {glyph(k)}
      </g>
    </svg>
  );
  return base;
}

function glyph(k: string) {
  switch (k) {
    case "tree":
      return (
        <>
          <rect x={-2} y={4} width={4} height={10} fill="rgba(120, 83, 58, 0.65)" rx={1} />
          <circle cx={0} cy={-2} r={11} fill={FILL2} stroke={STROKE} strokeWidth={SW} />
          <circle cx={-5} cy={2} r={6} fill={FILL2} stroke={STROKE} strokeWidth={SW * 0.85} />
          <circle cx={6} cy={1} r={5} fill={FILL2} stroke={STROKE} strokeWidth={SW * 0.85} />
        </>
      );
    case "bush":
      return (
        <>
          <circle cx={-6} cy={0} r={7} fill={FILL2} stroke={STROKE} strokeWidth={SW} />
          <circle cx={6} cy={1} r={8} fill={FILL2} stroke={STROKE} strokeWidth={SW} />
          <circle cx={0} cy={-5} r={7} fill={FILL2} stroke={STROKE} strokeWidth={SW} />
        </>
      );
    case "sprinkler":
      return (
        <>
          <circle cx={0} cy={0} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M0 -9 V-16 M-10 -12 H10 M-7 -14 H7" stroke={STROKE} strokeWidth={SW} />
        </>
      );
    case "valve":
      return (
        <>
          <rect x={-10} y={-3} width={20} height={6} fill={FILL} stroke={STROKE} strokeWidth={SW} rx={2} />
          <rect x={-3} y={-12} width={6} height={22} fill={FILL} stroke={STROKE} strokeWidth={SW} rx={2} />
        </>
      );
    case "pump":
      return (
        <>
          <circle cx={0} cy={0} r={10} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <rect x={-2.5} y={-16} width={5} height={7} stroke={STROKE} strokeWidth={SW} rx={1} />
          <path d="M-6 5 H6" stroke={STROKE} strokeWidth={SW * 0.85} />
        </>
      );
    case "motor":
      return (
        <>
          <circle cx={0} cy={0} r={11} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M-5 -4 L5 4 M5 -4 L-5 4" stroke={STROKE} strokeWidth={SW * 1.1} strokeLinecap="round" />
        </>
      );
    case "filter":
      return (
        <>
          <rect x={-8} y={-12} width={16} height={24} fill={FILL} stroke={STROKE} strokeWidth={SW} rx={3} />
          <path d="M-5 -6 H5 M-5 0 H5 M-5 6 H5" stroke={STROKE} strokeWidth={SW * 0.8} />
        </>
      );
    default:
      return (
        <>
          <circle cx={0} cy={0} r={10} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M-5 -2 H5" stroke={STROKE} strokeWidth={SW} />
        </>
      );
  }
}
