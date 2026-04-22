import type { Device } from "./iot-deployment-types";
import { IOT_DEFAULT_METERS_PER_PIXEL } from "./iot-deployment-types";

function boundsFromDevices(devices: Device[], mpp: number, padWorld: number) {
  if (devices.length === 0) {
    return { L: -400, T: -400, R: 400, B: 400 };
  }
  let L = Infinity;
  let R = -Infinity;
  let T = Infinity;
  let B = -Infinity;
  for (const d of devices) {
    const r = d.rangeMeters / mpp;
    L = Math.min(L, d.x - r);
    R = Math.max(R, d.x + r);
    T = Math.min(T, d.y - r);
    B = Math.max(B, d.y + r);
  }
  return { L: L - padWorld, R: R + padWorld, T: T - padWorld, B: B + padWorld };
}

/**
 * V1: coarse grid; cell center “covered” if inside any device’s circular range in world space.
 * Returns approximate coverage ratio and number of uncovered cells.
 */
export function computeCoverageGridStats(
  devices: Device[],
  metersPerPixel: number,
  options: { step: number; padWorld?: number } = { step: 25 },
) {
  const mpp = metersPerPixel > 0 ? metersPerPixel : IOT_DEFAULT_METERS_PER_PIXEL;
  const step = options.step;
  const pad = options.padWorld ?? 20;
  if (devices.length === 0) {
    return { percent: 0, totalCells: 0, coveredCells: 0, uncoveredCells: 0, bounds: boundsFromDevices(devices, mpp, pad) };
  }
  const b = boundsFromDevices(devices, mpp, pad);
  let total = 0;
  let covered = 0;
  for (let y = b.T; y <= b.B; y += step) {
    for (let x = b.L; x <= b.R; x += step) {
      total += 1;
      let inAny = false;
      for (const d of devices) {
        const rad = d.rangeMeters / mpp;
        if (rad > 0 && (x - d.x) ** 2 + (y - d.y) ** 2 <= rad * rad) {
          inAny = true;
          break;
        }
      }
      if (inAny) covered += 1;
    }
  }
  const percent = total > 0 ? Math.round((covered / total) * 1000) / 10 : 0;
  return { percent, totalCells: total, coveredCells: covered, uncoveredCells: total - covered, bounds: b };
}

export function computeGapPointMarkers(
  devices: Device[],
  metersPerPixel: number,
  step: number,
): { x: number; y: number }[] {
  if (devices.length === 0) return [];
  const mpp = metersPerPixel > 0 ? metersPerPixel : IOT_DEFAULT_METERS_PER_PIXEL;
  const b = boundsFromDevices(devices, mpp, 20);
  const out: { x: number; y: number }[] = [];
  for (let y = b.T; y <= b.B; y += step) {
    for (let x = b.L; x <= b.R; x += step) {
      let inAny = false;
      for (const d of devices) {
        const rad = d.rangeMeters / mpp;
        if (rad > 0 && (x - d.x) ** 2 + (y - d.y) ** 2 <= rad * rad) {
          inAny = true;
          break;
        }
      }
      if (!inAny) out.push({ x, y });
    }
  }
  const maxOut = 2800;
  if (out.length > maxOut) {
    const stride = Math.ceil(out.length / maxOut);
    return out.filter((_, i) => i % stride === 0);
  }
  return out;
}
