"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Fits fixed-width column content into a dashboard grid cell using `transform: scale`.
 * Prevents flex/grid reflow misalignment when tiles are resized in edit mode.
 */
export function ScaledFit({
  children,
  designWidthPx,
  className,
}: {
  children: ReactNode;
  designWidthPx: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentH, setContentH] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const ih = measure.scrollHeight;
      const iw = designWidthPx;
      if (cw <= 0 || ch <= 0) return;
      const pad = 2;
      if (ih <= 0) {
        const s = Math.min(1, (cw - pad) / iw);
        setScale(Math.max(0.32, s));
        setContentH(0);
        return;
      }
      const s = Math.min(1, (cw - pad) / iw, (ch - pad) / ih);
      const clamped = Math.max(0.32, Math.min(1, s));
      setScale(clamped);
      setContentH(ih);
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(container);
    ro.observe(measure);
    update();
    return () => ro.disconnect();
  }, [designWidthPx]);

  const clipW = designWidthPx * scale;
  const clipH = contentH * scale;

  return (
    <div ref={containerRef} className={cn("min-h-0 flex-1 overflow-hidden", className)}>
      <div className="flex h-full min-h-0 w-full items-start justify-center overflow-hidden">
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: clipW > 0 ? clipW : designWidthPx,
            height: clipH > 0 ? clipH : undefined,
          }}
        >
          <div
            ref={measureRef}
            style={{
              width: designWidthPx,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              willChange: "transform",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
