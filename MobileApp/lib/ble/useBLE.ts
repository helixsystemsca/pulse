import { useEffect, useMemo, useState } from "react";

export type ProximityKind = "equipment" | "vehicle" | "zone";

export type ProximityEvent = {
  kind: ProximityKind;
  label: string;
};

function mockBleEnabled(): boolean {
  // Default OFF so the app doesn't spam proximity prompts/notifications.
  return String(process.env.EXPO_PUBLIC_MOCK_BLE ?? "").trim() === "true";
}

/**
 * BLE proximity scaffold (simulated).
 * Set `EXPO_PUBLIC_MOCK_BLE=true` to enable local fake proximity prompts.
 */
export function useBLE() {
  const [event, setEvent] = useState<ProximityEvent | null>(null);

  useEffect(() => {
    if (!mockBleEnabled()) return;
    const labels: ProximityEvent[] = [
      { kind: "equipment", label: "Pump Skid 7" },
      { kind: "vehicle", label: "Forklift #2" },
      { kind: "zone", label: "Boiler Room" },
    ];

    const t = setInterval(() => {
      // 15% chance to emit a prompt.
      if (Math.random() > 0.15) return;
      const pick = labels[Math.floor(Math.random() * labels.length)]!;
      setEvent(pick);
    }, 6500);
    return () => clearInterval(t);
  }, []);

  return useMemo(
    () => ({
      event,
      dismiss: () => setEvent(null),
    }),
    [event],
  );
}

