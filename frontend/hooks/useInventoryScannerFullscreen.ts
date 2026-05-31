"use client";

import { useEffect } from "react";
import { requestInventoryScannerFullscreen } from "@/lib/inventory-scanner/scanner-kiosk";

/** Tablet kiosk: enter browser fullscreen when the scanner page mounts. */
export function useInventoryScannerFullscreen(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    void requestInventoryScannerFullscreen();
  }, [enabled]);
}
