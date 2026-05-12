"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks vertical scroll on the primary `main` scroll region (Pulse `AppLayout`).
 * Use to slightly compact sticky headers / toolbars (8–16px range).
 */
export function useMainScrollCompaction(thresholdPx = 28) {
  const [compact, setCompact] = useState(false);

  const onScroll = useCallback(
    (el: HTMLElement) => {
      setCompact(el.scrollTop > thresholdPx);
    },
    [thresholdPx],
  );

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const handler = () => onScroll(main);
    handler();
    main.addEventListener("scroll", handler, { passive: true });
    return () => main.removeEventListener("scroll", handler);
  }, [onScroll]);

  return compact;
}
