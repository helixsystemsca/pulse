/** Naming and geometry helpers for the Infrastructure Map Builder. */

export function uniqueLabel(base: string, names: Iterable<string>): string {
  const used = new Set(names);
  let n = 1;
  let s = `${base} ${n}`;
  while (used.has(s)) {
    n += 1;
    s = `${base} ${n}`;
  }
  return s;
}

export function bboxFromFlatPoly(flat: number[]): { x: number; y: number; w: number; h: number } {
  let L = Infinity;
  let T = Infinity;
  let R = -Infinity;
  let B = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    L = Math.min(L, flat[i]!);
    R = Math.max(R, flat[i]!);
    T = Math.min(T, flat[i + 1]!);
    B = Math.max(B, flat[i + 1]!);
  }
  if (!Number.isFinite(L)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: L, y: T, w: R - L, h: B - T };
}
