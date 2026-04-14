/**
 * Pen draft: anchors with optional quadratic control on each anchor (segment *into* this anchor from previous).
 */

export type PenDraftAnchor = {
  x: number;
  y: number;
  /** Quadratic control for segment from previous anchor to this anchor (world space). */
  qc?: { x: number; y: number };
};

const SAMPLE_STEP = 5;

function sampleQuad(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, out: number[]) {
  const steps = Math.max(8, Math.ceil(Math.hypot(bx - ax, by - ay) / SAMPLE_STEP));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const omt = 1 - t;
    const x = omt * omt * ax + 2 * omt * t * cx + t * t * bx;
    const y = omt * omt * ay + 2 * omt * t * cy + t * t * by;
    if (out.length >= 2) {
      const lx = out[out.length - 2]!;
      const ly = out[out.length - 1]!;
      if (Math.hypot(x - lx, y - ly) < 1.2) continue;
    }
    out.push(x, y);
  }
}

function sampleLine(ax: number, ay: number, bx: number, by: number, out: number[]) {
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / SAMPLE_STEP));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
  }
}

/**
 * Flatten pen anchors into a closed `path_points` ring (open ring, no repeated first vertex).
 */
export function flattenPenDraftToClosedPath(anchors: PenDraftAnchor[]): number[] | null {
  if (anchors.length < 3) return null;
  const flat: number[] = [];
  const n = anchors.length;
  for (let i = 0; i < n; i++) {
    const from = anchors[i]!;
    const to = anchors[(i + 1) % n]!;
    const skipFirst = flat.length > 0;
    const seg: number[] = [];
    if (to.qc) {
      sampleQuad(from.x, from.y, to.qc.x, to.qc.y, to.x, to.y, seg);
    } else {
      sampleLine(from.x, from.y, to.x, to.y, seg);
    }
    let start = 0;
    if (skipFirst && seg.length >= 2) start = 2;
    for (let j = start; j < seg.length; j++) {
      flat.push(seg[j]!);
    }
  }
  if (flat.length < 6) return null;
  const fx = flat[0]!;
  const fy = flat[1]!;
  const lx = flat[flat.length - 2]!;
  const ly = flat[flat.length - 1]!;
  if (Math.hypot(fx - lx, fy - ly) < 2) {
    flat.pop();
    flat.pop();
  }
  return flat.length >= 6 ? flat : null;
}
