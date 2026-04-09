import React, { useEffect } from "react";
import { router } from "expo-router";
import { BottomSheetPrompt } from "@/components/BottomSheetPrompt";
import { useBLE } from "@/lib/ble/useBLE";

export function BLEPromptHost() {
  const { event, dismiss } = useBLE();

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
    <BottomSheetPrompt
      title={title}
      message={message}
      primaryLabel="Open"
      onPrimary={() => {
        dismiss();
        router.push(primaryTo);
      }}
      onDismiss={dismiss}
    />
  );
}

