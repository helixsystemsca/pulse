"use client";

/** Cubic Bezier edge for network diagram (SVG user space). */
export function DependencyLine({
  x1,
  y1,
  x2,
  y2,
  critical,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  critical?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  const stroke = critical ? "var(--pm-color-critical)" : "var(--pm-color-primary)";
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={critical ? 2.5 : 2}
      markerEnd="url(#pm-arrow)"
      opacity={0.9}
    />
  );
}
