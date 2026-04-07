import simplify from "simplify-js";

export type FreehandPathOptions = {
  /** Douglas–Peucker tolerance (world px); higher removes more detail. */
  simplifyTolerance: number;
  /** Target samples per quadratic segment (scaled down for many vertices). */
  samplesPerEdge: number;
  /**
   * 0 = control points pulled toward chord mids (gentler curves).
   * 1 = full vertex control (best for irregular / garden outlines).
   */
  smoothingStrength: number;
  /** Snap first/last vertex when this close (world px) to treat stroke as closed. */
  closeSnapDist: number;
};

export const DEFAULT_FREEHAND_PATH_OPTIONS: FreehandPathOptions = {
  simplifyTolerance: 3.5,
  samplesPerEdge: 8,
  smoothingStrength: 0.96,
  closeSnapDist: 18,
};

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

/** Unique vertices; drop explicit closing duplicate if first ≈ last. */
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

function lerpXY(a: XY, b: XY, t: number): XY {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function mid(a: XY, b: XY): XY {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function quadPoint(A: XY, C: XY, B: XY, t: number): XY {
  const u = 1 - t;
  return {
    x: u * u * A.x + 2 * u * t * C.x + t * t * B.x,
    y: u * u * A.y + 2 * u * t * C.y + t * t * B.y,
  };
}

/**
 * Closed quadratic smoothing: each original vertex is the control point of a quad
 * from mid(prev,vertex) to mid(vertex,next). Preserves topology of the simplified ring.
 */
function quadBezierSmoothClosedRing(pts: XY[], samplesPerEdge: number, strength: number): number[] {
  const n = pts.length;
  if (n < 3) return xyToFlat(pts);

  const σ = Math.max(0, Math.min(1, strength));
  const M: XY[] = [];
  for (let i = 0; i < n; i++) {
    M.push(mid(pts[i]!, pts[(i + 1) % n]!));
  }

  const sp = Math.max(3, Math.min(14, Math.floor(samplesPerEdge)));
  const out: number[] = [];

  for (let i = 0; i < n; i++) {
    const A = M[(i - 1 + n) % n]!;
    const P = pts[i]!;
    const B = M[i]!;
    const chordMid = mid(A, B);
    const C = lerpXY(chordMid, P, σ);

    for (let s = 0; s < sp; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / sp;
      const q = quadPoint(A, C, B, t);
      out.push(q.x, q.y);
    }
  }

  return out.length >= 6 ? out : xyToFlat(pts);
}

function adaptiveSamplesPerEdge(vertexCount: number, base: number): number {
  if (vertexCount <= 0) return base;
  const scaled = Math.round((72 / vertexCount) * (base / 8));
  return Math.max(4, Math.min(14, scaled));
}

/**
 * Close freehand stroke → simplify-js (high-quality DP) → quadratic Bézier sampling → flat `path_points`.
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

  const samples = adaptiveSamplesPerEdge(simplified.length, o.samplesPerEdge);
  const flat = quadBezierSmoothClosedRing(simplified, samples, o.smoothingStrength);
  return flat.length >= 6 ? flat : null;
}
