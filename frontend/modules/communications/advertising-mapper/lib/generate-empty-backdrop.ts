import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

export type EmptyBackdropResult = {
  backdropUrl: string;
  backdropNaturalWidth: number;
  backdropNaturalHeight: number;
  width_inches: number;
  height_inches: number;
};

const PX_PER_INCH = 8;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * Extend the wall canvas with neutral “empty” space to the right and bottom.
 * Existing photo (if any) stays in the original inch footprint; new area is plot-ready.
 */
export async function generateEmptySpaceBackdrop(
  wall: FacilityWallPlan,
  opts?: { extraWidthInches?: number; extraHeightInches?: number },
): Promise<EmptyBackdropResult> {
  const extraW = opts?.extraWidthInches ?? 96;
  const extraH = opts?.extraHeightInches ?? 48;
  const newWIn = wall.width_inches + extraW;
  const newHIn = wall.height_inches + extraH;

  const oldWPx = Math.round(wall.width_inches * PX_PER_INCH);
  const oldHPx = Math.round(wall.height_inches * PX_PER_INCH);
  const canvasW = Math.round(newWIn * PX_PER_INCH);
  const canvasH = Math.round(newHIn * PX_PER_INCH);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not generate backdrop.");

  const emptyGrad = ctx.createLinearGradient(oldWPx, 0, canvasW, canvasH);
  emptyGrad.addColorStop(0, "#e8ecf2");
  emptyGrad.addColorStop(0.5, "#dfe4ec");
  emptyGrad.addColorStop(1, "#d5dce6");
  ctx.fillStyle = emptyGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (wall.backdropUrl) {
    const img = await loadImage(wall.backdropUrl);
    ctx.drawImage(img, 0, 0, oldWPx, oldHPx);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, oldWPx - 1, oldHPx - 1);
  } else {
    const photoGrad = ctx.createLinearGradient(0, 0, 0, oldHPx);
    photoGrad.addColorStop(0, "#3d4a5c");
    photoGrad.addColorStop(0.45, "#2a3344");
    photoGrad.addColorStop(1, "#121820");
    ctx.fillStyle = photoGrad;
    ctx.fillRect(0, 0, oldWPx, oldHPx);
  }

  ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText("Available plots", oldWPx + 16, oldHPx + 28);

  return {
    backdropUrl: canvas.toDataURL("image/jpeg", 0.9),
    backdropNaturalWidth: canvasW,
    backdropNaturalHeight: canvasH,
    width_inches: newWIn,
    height_inches: newHIn,
  };
}
