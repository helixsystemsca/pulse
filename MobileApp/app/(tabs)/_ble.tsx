import React, { useEffect, useMemo } from "react";
import { router, usePathname, useSegments } from "expo-router";
import { ProximityPromptBanner } from "@/components/ProximityPromptBanner";
import { useBLE } from "@/lib/ble/useBLE";

/** Clears dashboard hi/avatar row + padding; tune if logo is large. */
const HOME_HERO_CLEARANCE = 188;

export function BLEPromptHost() {
  const pathname = usePathname();
  const segments = useSegments();
  const { event, dismiss } = useBLE();

  const heroClearance = useMemo(() => {
    const path = pathname ?? "";
    const onHomeTab =
      path === "/" ||
      path === "/(tabs)" ||
      path.endsWith("/(tabs)/index") ||
      path.endsWith("/index") ||
      (segments as string[]).includes("index");
    return onHomeTab ? HOME_HERO_CLEARANCE : 0;
  }, [pathname, segments]);

  useEffect(() => {
    // no-op; hook holds state
  }, []);

  if (!event) return null;

  const title =
    event.kind === "equipment" ? "Near equipment" : event.kind === "vehicle" ? "Near vehicle" : "Near zone";
  const message =
    event.kind === "equipment"
      ? `You're near ${event.label}. Open Tasks to start work or record notes.`
      : event.kind === "vehicle"
        ? `You're near ${event.label}. Open Tasks to start an inspection.`
        : `You're in ${event.label}. Open Drawings to review zones.`;
  const primaryTo = event.kind === "zone" ? "/drawings" : "/tasks";

  return (
    <ProximityPromptBanner
      title={title}
      message={message}
      primaryLabel="Open"
      heroClearance={heroClearance}
      onPrimary={() => {
        dismiss();
        router.push(primaryTo);
      }}
      onDismiss={dismiss}
    />
  );
}

// Expo Router treats files in route directories as screens and expects a default export.
// This file also exports `BLEPromptHost` which is mounted from the tab layout.
export default function BLEPromptRoute() {
  return null;
}

