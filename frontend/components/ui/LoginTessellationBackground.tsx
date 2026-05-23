"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/** Equilateral triangle side length in screen pixels (smaller = denser grid). */
const SIDE_PX = 48;

const ROW_H = (SIDE_PX * Math.sqrt(3)) / 2;

const TEAL_FILLS = ["#99f6e4", "#5eead4", "#2dd4bf", "#22d3ee", "#14b8a6", "#67e8f9"];

/** Seeded PRNG — stable opacity per triangle index. */
function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function opacityForTriangle(
  cy: number,
  height: number,
  rng: () => number,
): number | null {
  const yNorm = Math.min(1, Math.max(0, cy / height));
  const verticalBias = 0.12 + Math.pow(yNorm, 0.62) * 0.88;
  const inBottomHalf = yNorm >= 0.5;
  const bottomBoost = inBottomHalf ? 1.12 + (yNorm - 0.5) * 0.5 : 1;
  const rA = rng();
  const rB = rng();
  const rC = rng();
  const rD = rng();

  const keepThreshold = verticalBias * ((inBottomHalf ? 0.5 : 0.42) + rB * 0.58);
  if (rA > keepThreshold) return null;

  const opacity = Math.min(
    inBottomHalf ? 0.34 : 0.28,
    verticalBias * Math.pow(rC, 1.65) * Math.pow(rD, 1.35) * (0.08 + rB * 0.22) * bottomBoost,
  );
  return opacity < 0.015 ? null : opacity;
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  fill: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Paint equilateral triangle tessellation in true screen pixels (no stretch). */
function paintTessellation(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);

  const cols = Math.ceil(width / SIDE_PX) + 4;
  const rows = Math.ceil(height / ROW_H) + 4;

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const stagger = (r % 2) * (SIDE_PX / 2);
      const ax = c * SIDE_PX + stagger - SIDE_PX;
      const ay = r * ROW_H - ROW_H * 0.5;
      const bx = ax + SIDE_PX;
      const by = ay;
      const dx = ax + SIDE_PX / 2;
      const dy = ay + ROW_H;
      const ex = bx + SIDE_PX / 2;
      const ey = dy;

      const tris: [number, number, number, number, number, number][] = [
        [ax, ay, bx, by, dx, dy],
        [bx, by, ex, ey, dx, dy],
      ];

      tris.forEach((coords, ti) => {
        const cy = (coords[1] + coords[3] + coords[5]) / 3;
        const rng = mulberry32(0x7a3c91 + r * 4099 + c * 97 + ti * 31);
        const opacity = opacityForTriangle(cy, height, rng);
        if (opacity == null) return;
        const fill = TEAL_FILLS[Math.floor(rng() * TEAL_FILLS.length)]!;
        drawTriangle(ctx, coords[0], coords[1], coords[2], coords[3], coords[4], coords[5], fill, opacity);
      });
    }
  }
}

export type LoginTessellationBackgroundProps = {
  className?: string;
};

/**
 * Low-opacity equilateral triangle overlay for login — canvas keeps every
 * triangle symmetrical; sits above {@link AuroraBackground}.
 */
export function LoginTessellationBackground({ className }: LoginTessellationBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const paint = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTessellation(ctx, w, h);
    };

    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(container);
    window.addEventListener("resize", paint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", paint);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0 z-[1] overflow-hidden", className)}
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(255, 255, 255, 0.75) 0%,
              rgba(255, 255, 255, 0.35) 18%,
              rgba(255, 255, 255, 0.08) 40%,
              transparent 65%
            )
          `,
        }}
      />
    </div>
  );
}
