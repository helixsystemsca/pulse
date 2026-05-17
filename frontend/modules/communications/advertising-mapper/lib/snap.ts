export function snapInches(value: number, gridInches: number, enabled: boolean): number {
  if (!enabled || gridInches <= 0) return value;
  return Math.round(value / gridInches) * gridInches;
}

export function clampBlockToWall(
  x: number,
  y: number,
  width: number,
  height: number,
  wallWidth: number,
  wallHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(0, wallWidth - width);
  const maxY = Math.max(0, wallHeight - height);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

export function clampBlockSize(
  width: number,
  height: number,
  minInches = 6,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  let w = Math.max(minInches, width);
  let h = Math.max(minInches, height);
  if (maxWidth !== undefined) w = Math.min(w, maxWidth);
  if (maxHeight !== undefined) h = Math.min(h, maxHeight);
  return { width: w, height: h };
}
