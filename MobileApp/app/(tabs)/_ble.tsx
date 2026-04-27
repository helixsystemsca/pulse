import React, { useEffect, useMemo, useState } from "react";
import { router, usePathname, useSegments } from "expo-router";
import { ProximityPromptBanner } from "@/components/ProximityPromptBanner";
import { useBLE } from "@/lib/ble/useBLE";
import { useSession } from "@/store/session";
import { subscribePulseWs, type PulseWsEvent } from "@/lib/realtime/pulseWs";

/** Clears dashboard hi/avatar row + padding; tune if logo is large. */
const HOME_HERO_CLEARANCE = 188;

export function BLEPromptHost() {
  const pathname = usePathname();
  const segments = useSegments();
  const { event, dismiss } = useBLE();
  const { session } = useSession();

  const [inferencePayload, setInferencePayload] = useState<{
    inference_id: string;
    asset_name: string;
    pm_name?: string;
    pm_overdue_days: number;
    confidence: number;
    work_order_id?: string;
  } | null>(null);

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

  useEffect(() => {
    if (!session?.token) return;
    return subscribePulseWs(session.token, (evt: PulseWsEvent) => {
      if (evt.event_type === "maintenance_inference_request" || evt.event_type === "demo_inference_fired") {
        const meta = evt.metadata ?? {};
        setInferencePayload({
          inference_id: String(meta.inference_id ?? evt.entity_id ?? ""),
          asset_name: String(meta.asset_name ?? "Unknown asset"),
          pm_name: meta.pm_name ? String(meta.pm_name) : undefined,
          pm_overdue_days: Number(meta.pm_overdue_days ?? 0),
          confidence: Number(meta.confidence ?? 0),
          work_order_id: meta.work_order_id ? String(meta.work_order_id) : undefined,
        });
      }
    });
  }, [session?.token]);

  if (!event && !inferencePayload) return null;

  if (inferencePayload) {
    return (
      <ProximityPromptBanner
        title="Maintenance detected"
        message={`Pulse detected work on ${inferencePayload.asset_name}. Confirm to log it instantly.`}
        primaryLabel="Confirm"
        heroClearance={heroClearance}
        onPrimary={() => {
          router.push({
            pathname: "/inference-confirm",
            params: {
              inference_id: inferencePayload.inference_id,
              asset_name: inferencePayload.asset_name,
              pm_name: inferencePayload.pm_name ?? "",
              pm_overdue_days: String(inferencePayload.pm_overdue_days),
              confidence: String(inferencePayload.confidence),
              work_order_id: inferencePayload.work_order_id ?? "",
            },
          } as never);
          setInferencePayload(null);
        }}
        onDismiss={() => setInferencePayload(null)}
      />
    );
  }

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

