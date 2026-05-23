"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

const TEAL_FILLS = ["#99f6e4", "#5eead4", "#2dd4bf", "#22d3ee", "#14b8a6", "#67e8f9"];

type TessellationLayer = {
  sidePx: number;
  /** 0–1 — fraction of cells that may draw a triangle. */
  density: number;
  /** Max opacity cap for this scale (larger = softer). */
  maxOpacity: number;
  layerSeed: number;
};

const LAYERS: TessellationLayer[] = [
  { sidePx: 44, density: 1, maxOpacity: 0.3, layerSeed: 0x7a3c91 },
  { sidePx: 88, density: 0.55, maxOpacity: 0.22, layerSeed: 0x4e2b11 },
  { sidePx: 140, density: 0.32, maxOpacity: 0.16, layerSeed: 0x9c1f44 },
];

/** Seeded PRNG — stable per triangle. */
function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft cloud-like visibility field (Photoshop cloud-mask feel). */
function cloudMaskAt(cx: number, cy: number, width: number, height: number): number {
  const nx = cx / Math.max(width, 1);
  const ny = cy / Math.max(height, 1);
  const n1 = Math.sin(nx * 11.2 + ny * 7.4) * 0.5 + 0.5;
  const n2 = Math.sin(nx * 23.5 - ny * 18.1 + 1.7) * 0.5 + 0.5;
  const n3 = Math.sin(nx * 5.8 + ny * 14.3 + 4.2) * 0.5 + 0.5;
  const n4 = Math.sin((nx + ny) * 9.1 - 2.3) * 0.5 + 0.5;
  return n1 * 0.34 + n2 * 0.26 + n3 * 0.22 + n4 * 0.18;
}

function opacityForTriangle(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rng: () => number,
  maxOpacity: number,
): number | null {
  const yNorm = Math.min(1, Math.max(0, cy / height));
  const verticalBias = 0.1 + Math.pow(yNorm, 0.58) * 0.9;
  const inBottomHalf = yNorm >= 0.5;
  const bottomBoost = inBottomHalf ? 1.1 + (yNorm - 0.5) * 0.45 : 1;

  const cloud = cloudMaskAt(cx, cy, width, height);
  const rA = rng();
  const rB = rng();
  const rC = rng();
  const rD = rng();

  const cloudKeep = 0.28 + cloud * 0.72;
  const keepThreshold = verticalBias * cloudKeep * ((inBottomHalf ? 0.48 : 0.38) + rB * 0.62);
  if (rA > keepThreshold) return null;

  const opacity = Math.min(
    maxOpacity,
    verticalBias *
      cloud *
      Math.pow(rC, 1.55) *
      Math.pow(rD, 1.25) *
      (0.06 + rB * 0.24) *
      bottomBoost,
  );
  return opacity < 0.012 ? null : opacity;
}

function rotatePoints(
  coords: [number, number, number, number, number, number],
  angleRad: number,
): [number, number, number, number, number, number] {
  const cx = (coords[0] + coords[2] + coords[4]) / 3;
  const cy = (coords[1] + coords[3] + coords[5]) / 3;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const out: number[] = [];
  for (let i = 0; i < 6; i += 2) {
    const dx = coords[i]! - cx;
    const dy = coords[i + 1]! - cy;
    out.push(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
  }
  return out as [number, number, number, number, number, number];
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  coords: [number, number, number, number, number, number],
  fill: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(coords[0], coords[1]);
  ctx.lineTo(coords[2], coords[3]);
  ctx.lineTo(coords[4], coords[5]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { sidePx, density, maxOpacity, layerSeed }: TessellationLayer,
) {
  const rowH = (sidePx * Math.sqrt(3)) / 2;
  const cols = Math.ceil(width / sidePx) + 4;
  const rows = Math.ceil(height / rowH) + 4;

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const cellRng = mulberry32(layerSeed + r * 4099 + c * 97);
      if (cellRng() > density) continue;

      const stagger = (r % 2) * (sidePx / 2);
      const ax = c * sidePx + stagger - sidePx;
      const ay = r * rowH - rowH * 0.5;
      const bx = ax + sidePx;
      const by = ay;
      const dx = ax + sidePx / 2;
      const dy = ay + rowH;
      const ex = bx + sidePx / 2;
      const ey = dy;

      const tris: [number, number, number, number, number, number][] = [
        [ax, ay, bx, by, dx, dy],
        [bx, by, ex, ey, dx, dy],
      ];

      tris.forEach((baseCoords, ti) => {
        const triRng = mulberry32(layerSeed + r * 8191 + c * 193 + ti * 47);
        const cx = (baseCoords[0] + baseCoords[2] + baseCoords[4]) / 3;
        const cy = (baseCoords[1] + baseCoords[3] + baseCoords[5]) / 3;
        const opacity = opacityForTriangle(cx, cy, width, height, triRng, maxOpacity);
        if (opacity == null) return;

        const angle = triRng() * Math.PI * 2;
        const coords = rotatePoints(baseCoords, angle);
        const fill = TEAL_FILLS[Math.floor(triRng() * TEAL_FILLS.length)]!;
        drawTriangle(ctx, coords, fill, opacity);
      });
    }
  }
}

function paintTessellation(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  for (const layer of LAYERS) {
    paintLayer(ctx, width, height, layer);
  }
}

export type LoginTessellationBackgroundProps = {
  className?: string;
};

/**
 * Multi-scale equilateral triangle overlay — varied size, rotation, and
 * cloud-masked opacity; sits above {@link AuroraBackground}.
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
            radial-gradient(ellipse 72% 58% at 50% 42%,
              rgba(255, 255, 255, 0.55) 0%,
              rgba(255, 255, 255, 0.18) 42%,
              transparent 72%
            ),
            linear-gradient(180deg,
              rgba(255, 255, 255, 0.72) 0%,
              rgba(255, 255, 255, 0.32) 16%,
              rgba(255, 255, 255, 0.06) 38%,
              transparent 62%
            )
          `,
        }}
      />
    </div>
  );
}
