/** Fullscreen inventory scanner route (minimal kiosk shell, no app chrome). */
export const INVENTORY_SCANNER_KIOSK_PATH = "/kiosk/inventory-scanner";

/** Query flag: `?kiosk=1` — browser fullscreen + intended for a fixed tablet window. */
export const INVENTORY_SCANNER_KIOSK_QUERY = "kiosk";

export type InventoryScannerMode = "issue" | "receive";

export function inventoryScannerHref(opts?: {
  kioskDisplay?: boolean;
  mode?: InventoryScannerMode;
}): string {
  const params = new URLSearchParams();
  if (opts?.kioskDisplay) params.set(INVENTORY_SCANNER_KIOSK_QUERY, "1");
  if (opts?.mode) params.set("mode", opts.mode);
  const q = params.toString();
  return q ? `${INVENTORY_SCANNER_KIOSK_PATH}?${q}` : INVENTORY_SCANNER_KIOSK_PATH;
}

export function isInventoryScannerKioskDisplayParam(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

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
