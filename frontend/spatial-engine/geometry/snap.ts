export function snapToGrid(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function clampPointToRect(
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  boundsWidth: number,
  boundsHeight: number,
): { x: number; y: number } {
  const maxX = Math.max(0, boundsWidth - rectWidth);
  const maxY = Math.max(0, boundsHeight - rectHeight);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  };
}

export function clampSize(
  width: number,
  height: number,
  minSize: number,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  let w = Math.max(minSize, width);
  let h = Math.max(minSize, height);
  if (maxWidth !== undefined) w = Math.min(w, maxWidth);
  if (maxHeight !== undefined) h = Math.min(h, maxHeight);
  return { width: w, height: h };
}
