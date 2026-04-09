import React, { useEffect, useMemo } from "react";
import { router, useSegments } from "expo-router";
import { ProximityPromptBanner } from "@/components/ProximityPromptBanner";
import { useBLE } from "@/lib/ble/useBLE";

/** Approx. dashboard hero height (greeting + optional logo) so the banner clears the ImageBackground header. */
const HOME_HERO_OFFSET = 168;

export function BLEPromptHost() {
  const segments = useSegments();
  const { event, dismiss } = useBLE();

  const layoutTopOffset = useMemo(() => {
    const leaf = segments[segments.length - 1] ?? "";
    return leaf === "index" ? HOME_HERO_OFFSET : 0;
  }, [segments]);

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
      layoutTopOffset={layoutTopOffset}
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

