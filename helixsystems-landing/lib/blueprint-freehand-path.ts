import simplify from "simplify-js";

export type FreehandPathOptions = {
  /** Douglas–Peucker tolerance (world px); higher removes more vertices. */
  simplifyTolerance: number;
  /** Catmull–Rom → cubic strength: 0 = nearly straight segments, 1 = full tangents. */
  curveIntensity: number;
  /** Bézier samples per edge after simplification. */
  samplesPerEdge: number;
  /** Snap first/last vertex when this close (world px) to treat stroke as closed. */
  closeSnapDist: number;
};

export const DEFAULT_FREEHAND_PATH_OPTIONS: FreehandPathOptions = {
  simplifyTolerance: 3.2,
  curveIntensity: 0.72,
  samplesPerEdge: 10,
  closeSnapDist: 18,
};

/** Map UI slider 0–100 → processing options (higher = more simplify + smoother curves). */
export function freehandOptionsFromSlider(slider0to100: number): FreehandPathOptions {
  const t = Math.max(0, Math.min(100, slider0to100)) / 100;
  return {
    ...DEFAULT_FREEHAND_PATH_OPTIONS,
    simplifyTolerance: 0.35 + t * 13.5,
    curveIntensity: t * 0.98,
    samplesPerEdge: Math.round(4 + t * 12),
    closeSnapDist: DEFAULT_FREEHAND_PATH_OPTIONS.closeSnapDist,
  };
}

type XY = { x: number; y: number };

function closeRingFlat(flat: number[], snapDist: number): number[] {
  if (flat.length < 4) return flat.slice();
  const x0 = flat[0]!;
  const y0 = flat[1]!;
  const x1 = flat[flat.length - 2]!;
  const y1 = flat[flat.length - 1]!;
  if (Math.hypot(x1 - x0, y1 - y0) <= snapDist) {
    return flat.slice(0, -2);
  }
  return [...flat, x0, y0];
}

function flatToXYRing(flat: number[]): XY[] {
  const pts: XY[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pts.push({ x: flat[i]!, y: flat[i + 1]! });
  }
  if (pts.length >= 2) {
    const f = pts[0]!;
    const l = pts[pts.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) < 0.25) pts.pop();
  }
  return pts;
}

function xyToFlat(pts: XY[]): number[] {
  const out: number[] = [];
  for (const p of pts) out.push(p.x, p.y);
  return out;
}

function bezierCubic(p0: XY, p1: XY, p2: XY, p3: XY, t: number): XY {
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: u3 * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t3 * p3.x,
    y: u3 * p0.y + 3 * u2 * t * p1.y + 3 * u * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Closed Catmull–Rom spline (uniform) expressed as cubic Bézier segments, flattened to a polyline.
 * Control handles use the standard conversion from four consecutive points.
 */
function catmullRomClosedToFlat(pts: XY[], intensity: number, samplesPerEdge: number): number[] {
  const n = pts.length;
  if (n < 3) return xyToFlat(pts);

  const σ = Math.max(0, Math.min(1, intensity));
  const sp = Math.max(2, Math.min(24, Math.floor(samplesPerEdge)));
  const out: number[] = [];
  const div = 6 / Math.max(0.08, σ || 0.08);

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const cp1: XY = {
      x: p1.x + ((p2.x - p0.x) * σ) / div,
      y: p1.y + ((p2.y - p0.y) * σ) / div,
    };
    const cp2: XY = {
      x: p2.x - ((p3.x - p1.x) * σ) / div,
      y: p2.y - ((p3.y - p1.y) * σ) / div,
    };

    for (let s = 0; s < sp; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / sp;
      const q = bezierCubic(p1, cp1, cp2, p2, t);
      out.push(q.x, q.y);
    }
  }

  return out.length >= 6 ? out : xyToFlat(pts);
}

/**
 * Close freehand stroke → simplify-js → Catmull–Rom (cubic Bézier) flattening.
 * Output is suitable for Konva `Line` with `closed` and `tension={0}`.
 */
export function processFreehandPath(raw: number[], options: Partial<FreehandPathOptions> = {}): number[] | null {
  const o = { ...DEFAULT_FREEHAND_PATH_OPTIONS, ...options };
  if (raw.length < 6) return null;

  const ring = closeRingFlat(raw, o.closeSnapDist);
  if (ring.length < 6) return null;

  let pts = flatToXYRing(ring);
  if (pts.length < 3) return null;

  const closed = [...pts, pts[0]!];
  let simplified = simplify(closed, o.simplifyTolerance, true);
  if (simplified.length < 2) return null;

  const sf = simplified[0]!;
  const sl = simplified[simplified.length - 1]!;
  if (Math.hypot(sf.x - sl.x, sf.y - sl.y) < 0.25) {
    simplified = simplified.slice(0, -1);
  }
  if (simplified.length < 3) return null;

  const flat = catmullRomClosedToFlat(simplified as XY[], o.curveIntensity, o.samplesPerEdge);
  return flat.length >= 6 ? flat : null;
}
