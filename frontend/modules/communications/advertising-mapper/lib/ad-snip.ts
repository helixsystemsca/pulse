import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

export type WallSnipRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CARD_MAX_PX = 320;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load backdrop image."));
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/** Map a wall-inch rectangle to backdrop image pixels and export a card thumbnail. */
export async function snipRegionFromBackdrop(
  wall: FacilityWallPlan,
  region: WallSnipRect,
): Promise<string> {
  if (!wall.backdropUrl) {
    throw new Error("Upload a background photo before snipping ads.");
  }
  const nw = wall.backdropNaturalWidth ?? 0;
  const nh = wall.backdropNaturalHeight ?? 0;
  if (nw < 1 || nh < 1) {
    throw new Error("Backdrop image dimensions are missing.");
  }

  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const wIn = Math.max(6, Math.min(region.width, wall.width_inches - x));
  const hIn = Math.max(6, Math.min(region.height, wall.height_inches - y));

  const sx = (x / wall.width_inches) * nw;
  const sy = (y / wall.height_inches) * nh;
  const sw = (wIn / wall.width_inches) * nw;
  const sh = (hIn / wall.height_inches) * nh;

  const img = await loadImage(wall.backdropUrl);
  const scale = Math.min(1, CARD_MAX_PX / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * scale));
  const ch = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create snip canvas.");

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function normalizeSnipRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  wall: FacilityWallPlan,
  minInches = 12,
): WallSnipRect | null {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  let width = Math.abs(x1 - x0);
  let height = Math.abs(y1 - y0);
  if (width < minInches || height < minInches) return null;
  width = Math.min(width, wall.width_inches - x);
  height = Math.min(height, wall.height_inches - y);
  if (width < minInches || height < minInches) return null;
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width,
    height,
  };
}
