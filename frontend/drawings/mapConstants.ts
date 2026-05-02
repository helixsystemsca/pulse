/** Persisted as `BlueprintElement.symbol_type` for the facility floor / aerial underlay. */
export const DRAWINGS_BASE_IMAGE_SYMBOL = "drawings_base_image";

export type DrawingsBaseImageNotes = { dataUrl: string };

export function parseDrawingsBaseImageNotes(raw: string | null | undefined): DrawingsBaseImageNotes | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && typeof (j as DrawingsBaseImageNotes).dataUrl === "string") {
      const dataUrl = (j as DrawingsBaseImageNotes).dataUrl;
      return dataUrl.startsWith("data:image/") ? { dataUrl } : null;
    }
  } catch {
    return null;
  }
  return null;
}
