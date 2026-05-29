import { BASE_PX_PER_INCH, RULER_THICKNESS_PX } from "@/modules/communications/advertising-mapper/lib/coordinates";

/** Wall inches that letterbox a backdrop inside the drawable viewport (preserve aspect). */
export function wallInchesFromBackdropFit(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): { width_inches: number; height_inches: number } {
  const drawableW = Math.max(1, containerWidth - RULER_THICKNESS_PX);
  const drawableH = Math.max(1, containerHeight - RULER_THICKNESS_PX);
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const scale = Math.min(drawableW / nw, drawableH / nh);
  const displayW = nw * scale;
  const displayH = nh * scale;
  return {
    width_inches: roundInches(displayW / BASE_PX_PER_INCH),
    height_inches: roundInches(displayH / BASE_PX_PER_INCH),
  };
}

function roundInches(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Konva draw rect — image letterboxed inside wall bounds. */
export function backdropImageLetterbox(
  wallWidthPx: number,
  wallHeightPx: number,
  image: HTMLImageElement,
  naturalWidth?: number,
  naturalHeight?: number,
  align: "center" | "end" = "center",
): { x: number; y: number; width: number; height: number } {
  const nw = naturalWidth ?? image.naturalWidth ?? image.width;
  const nh = naturalHeight ?? image.naturalHeight ?? image.height;
  const scale = Math.min(wallWidthPx / nw, wallHeightPx / nh);
  const width = nw * scale;
  const height = nh * scale;
  const x = align === "end" ? wallWidthPx - width : (wallWidthPx - width) / 2;
  return {
    x,
    y: (wallHeightPx - height) / 2,
    width,
    height,
  };
}
