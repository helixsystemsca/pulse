export type WallBackdropPatch = {
  backdropUrl: string;
  backdropNaturalWidth: number;
  backdropNaturalHeight: number;
};

const DEFAULT_MAX_DIMENSION = 1920;
const DEFAULT_JPEG_QUALITY = 0.82;

/** Resize and compress an image file for canvas backdrop + local persistence. */
export async function processBackdropImageFile(
  file: File,
  opts?: { maxDimension?: number; quality?: number },
): Promise<WallBackdropPatch> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  const maxDimension = opts?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts?.quality ?? DEFAULT_JPEG_QUALITY;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl =
      file.type === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", quality);

    return {
      backdropUrl: dataUrl,
      backdropNaturalWidth: w,
      backdropNaturalHeight: h,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image file."));
    img.src = src;
  });
}
