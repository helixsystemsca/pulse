import { useEffect, useMemo, useState } from "react";

export type ProximityKind = "equipment" | "vehicle" | "zone";

export type ProximityEvent = {
  kind: ProximityKind;
  label: string;
};

/**
 * BLE proximity scaffold (simulated).
 * Replace this with real BLE scanning later; keep UX behavior stable.
 */
export function useBLE() {
  const [event, setEvent] = useState<ProximityEvent | null>(null);

  useEffect(() => {
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

