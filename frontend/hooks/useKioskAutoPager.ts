"use client";

import { useEffect, useState } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { kioskPageDwellMs, kioskPageOffsets } from "@/lib/dashboards/kiosk";

const CONTENT_RECHECK_MS = 4_000;
const REF_RETRY_MS = 120;

export type KioskPagerStatus = {
  page: number;
  total: number;
};

/**
 * Wall-display pager: when the kiosk viewport cannot show the whole dashboard,
 * advance one screen every dwell interval (looping). No manual scroll required.
 */
export function useKioskAutoPager(
  enabled: boolean,
  containerRef: { readonly current: HTMLElement | null },
): KioskPagerStatus {
  const { reduced } = useReducedEffects();
  const [status, setStatus] = useState<KioskPagerStatus>({ page: 1, total: 1 });

  useEffect(() => {
    if (!enabled) {
      setStatus({ page: 1, total: 1 });
      return;
    }

    let cancelled = false;
    let timeoutId = 0;
    let pageIndex = 0;
    let offsets = [0];
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const publish = () => {
      const total = Math.max(1, offsets.length);
      const page = Math.min(pageIndex + 1, total);
      setStatus((prev) => (prev.page === page && prev.total === total ? prev : { page, total }));
    };

    const stopObservers = () => {
      ro?.disconnect();
      mo?.disconnect();
      ro = null;
      mo = null;
    };

    const run = (el: HTMLElement) => {
      const measure = () => {
        offsets = kioskPageOffsets(el.scrollHeight, el.clientHeight);
        if (pageIndex >= offsets.length) pageIndex = 0;
        publish();
      };

      const go = (index: number, wrapToTop: boolean) => {
        const y = offsets[index] ?? 0;
        el.scrollTo({
          top: y,
          behavior: wrapToTop || reduced ? "auto" : "smooth",
        });
      };

      const tick = () => {
        if (cancelled) return;
        measure();
        const dwell = offsets.length <= 1 ? CONTENT_RECHECK_MS : kioskPageDwellMs();
        timeoutId = window.setTimeout(() => {
          if (cancelled) return;
          measure();
          if (offsets.length <= 1) {
            tick();
            return;
          }
          const wrapToTop = pageIndex + 1 >= offsets.length;
          pageIndex = wrapToTop ? 0 : pageIndex + 1;
          go(pageIndex, wrapToTop);
          publish();
          tick();
        }, dwell);
      };

      const restartIfPageCountChanged = () => {
        const before = offsets.length;
        measure();
        if (offsets.length === before) return;
        window.clearTimeout(timeoutId);
        tick();
      };

      stopObservers();
      ro = new ResizeObserver(() => restartIfPageCountChanged());
      ro.observe(el);
      mo = new MutationObserver(() => restartIfPageCountChanged());
      mo.observe(el, { subtree: true, childList: true, attributes: true });

      measure();
      go(0, true);
      tick();
    };

    const start = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) {
        timeoutId = window.setTimeout(start, REF_RETRY_MS);
        return;
      }
      run(el);
    };

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      stopObservers();
    };
  }, [containerRef, enabled, reduced]);

  return status;
}
