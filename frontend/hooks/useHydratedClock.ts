"use client";

import { useEffect, useState } from "react";

/**
 * Live clock that only updates after mount — avoids SSR/client text mismatches.
 */
export function useHydratedClock(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
