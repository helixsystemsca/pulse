/** Fullscreen inventory scanner route (minimal kiosk shell, no app chrome). */
export const INVENTORY_SCANNER_KIOSK_PATH = "/kiosk/inventory-scanner";

/** Request browser fullscreen for tablet kiosk presentation. */
export async function requestInventoryScannerFullscreen(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    }
  } catch {
    /* blocked by browser policy or user preference */
  }
  return false;
}
