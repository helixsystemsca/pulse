"use client";

import { usePathname } from "next/navigation";
import { AppPoweredByFooter } from "./AppPoweredByFooter";

/** Hides the marketing strip on full-height tool routes (e.g. blueprint) so it does not overlap the canvas. */
export function AppLayoutFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/zones-devices/blueprint")) return null;
  return <AppPoweredByFooter />;
}
