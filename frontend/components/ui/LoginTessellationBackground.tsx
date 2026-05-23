"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

/** Fixed equilateral triangle edge length (px) — uniform grid across viewports. */
const CELL_PX = 52;

/** Seeded PRNG for stable random opacity across resizes. */
function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type TriangleSpec = {
  points: string;
  fill: string;
  opacity: number;
};

const TEAL_FILLS = ["#99f6e4", "#5eead4", "#2dd4bf", "#22d3ee", "#14b8a6", "#67e8f9"];

/** Uniform triangular lattice — no vertex jitter. */
function buildTessellation(width: number, height: number, seed = 0x7a3c91): TriangleSpec[] {
  if (width < 1 || height < 1) return [];

  const rng = mulberry32(seed);
  const cell = CELL_PX;
  const rowH = (cell * Math.sqrt(3)) / 2;
  const cols = Math.ceil(width / cell) + 3;
  const rows = Math.ceil(height / rowH) + 3;
  const triangles: TriangleSpec[] = [];

  const verts: { x: number; y: number }[][] = [];

  for (let r = 0; r < rows; r++) {
    verts[r] = [];
    for (let c = 0; c < cols; c++) {
      const stagger = (r % 2) * (cell / 2);
      verts[r][c] = {
        x: c * cell + stagger - cell,
        y: r * rowH - rowH * 0.5,
      };
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = verts[r]![c]!;
      const b = verts[r]![c + 1]!;
      const d = verts[r + 1]![c]!;
      const e = verts[r + 1]![c + 1]!;

      const specs: [{ p: typeof a; q: typeof b; s: typeof d }, { p: typeof b; q: typeof e; s: typeof d }] = [
        { p: a, q: b, s: d },
        { p: b, q: e, s: d },
      ];

      for (const { p, q, s } of specs) {
        const cy = (p.y + q.y + s.y) / 3;
        const yNorm = Math.min(1, Math.max(0, cy / height));

        /** Bottom slightly denser; top breaks apart with heavy random dropout. */
        const verticalBias = 0.12 + Math.pow(yNorm, 0.62) * 0.88;
        const rA = rng();
        const rB = rng();
        const rC = rng();
        const rD = rng();

        if (rA > verticalBias * (0.42 + rB * 0.58)) continue;

        const opacity = Math.min(
          0.28,
          verticalBias * Math.pow(rC, 1.65) * Math.pow(rD, 1.35) * (0.08 + rB * 0.22),
        );
        if (opacity < 0.015) continue;

        triangles.push({
          points: `${p.x},${p.y} ${q.x},${q.y} ${s.x},${s.y}`,
          fill: TEAL_FILLS[Math.floor(rng() * TEAL_FILLS.length)]!,
          opacity,
        });
      }
    }
  }

  return triangles;
}

export type LoginTessellationBackgroundProps = {
  className?: string;
};

/**
 * Low-opacity uniform triangle overlay for login — sits above {@link AuroraBackground}.
 */
export function LoginTessellationBackground({ className }: LoginTessellationBackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const read = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const triangles = useMemo(
    () => buildTessellation(size.width, size.height),
    [size.width, size.height],
  );

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[1] overflow-hidden", className)}
      aria-hidden
    >
      {size.width > 0 && size.height > 0 ? (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {triangles.map((t, i) => (
            <polygon
              key={i}
              points={t.points}
              fill={t.fill}
              fillOpacity={t.opacity}
              stroke={t.fill}
              strokeOpacity={t.opacity * 0.25}
              strokeWidth={0.5}
            />
          ))}
        </svg>
      ) : null}

      {/* Soft top fade so triangles dissolve without hiding the aurora */}
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
