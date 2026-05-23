"use client";

import { useEffect, useMemo, useState } from "react";

import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

/** Seeded PRNG for stable triangle scatter across resizes. */
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

const TEAL_FILLS = ["#99f6e4", "#5eead4", "#2dd4bf", "#22d3ee", "#14b8a6", "#0d9488", "#67e8f9"];

function buildTessellation(width: number, height: number, seed = 0x7a3c91): TriangleSpec[] {
  if (width < 1 || height < 1) return [];

  const rng = mulberry32(seed);
  const cell = Math.max(44, Math.min(64, Math.round(width / 28)));
  const rowH = (cell * Math.sqrt(3)) / 2;
  const cols = Math.ceil(width / cell) + 4;
  const rows = Math.ceil(height / rowH) + 4;
  const triangles: TriangleSpec[] = [];

  const verts: { x: number; y: number }[][] = [];

  for (let r = 0; r < rows; r++) {
    verts[r] = [];
    for (let c = 0; c < cols; c++) {
      const stagger = (r % 2) * (cell / 2);
      const jitterX = (rng() - 0.5) * cell * 0.42;
      const jitterY = (rng() - 0.5) * rowH * 0.38;
      verts[r][c] = {
        x: c * cell + stagger + jitterX - cell * 1.5,
        y: r * rowH + jitterY - rowH * 0.5,
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

        /** Stronger coverage at the bottom; sparse / breaking toward the top. */
        const verticalWeight = Math.pow(yNorm, 0.48);
        const scatter = 0.22 + rng() * 0.78;
        const dropout =
          yNorm < 0.22
            ? rng() > 0.08 + yNorm * 0.35
            : yNorm < 0.55
              ? rng() > 0.04 + (0.55 - yNorm) * 0.12
              : rng() > 0.015;

        if (!dropout) continue;

        const opacity = Math.min(0.72, verticalWeight * scatter * (0.35 + yNorm * 0.65));
        if (opacity < 0.04) continue;

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
 * Login canvas — teal triangular tessellation, dense/opaque at the bottom,
 * randomly thinning toward the top so the pattern appears to break apart.
 */
export function LoginTessellationBackground({ className }: LoginTessellationBackgroundProps) {
  const reduced = useReducedEffects();
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = document.documentElement;
    const read = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("resize", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  const triangles = useMemo(
    () => buildTessellation(size.width, size.height),
    [size.width, size.height],
  );

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Base wash: white top → aqua-teal bottom */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              #ffffff 0%,
              #f8fffe 18%,
              #ecfdf9 42%,
              #d4f7f0 68%,
              #a7f0e3 88%,
              #7ee8d8 100%
            )
          `,
        }}
      />

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
              strokeOpacity={t.opacity * 0.35}
              strokeWidth={0.6}
            />
          ))}
        </svg>
      ) : null}

      {/* Dissolve into white at the top */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              #ffffff 0%,
              rgba(255, 255, 255, 0.92) 12%,
              rgba(255, 255, 255, 0.55) 28%,
              rgba(255, 255, 255, 0.18) 48%,
              transparent 72%
            )
          `,
        }}
      />

      {/* Soft horizon haze */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% 100%,
              rgba(45, 212, 191, 0.35) 0%,
              rgba(94, 234, 212, 0.12) 42%,
              transparent 68%
            )
          `,
        }}
      />

      {!reduced ? (
        <div
          className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: "180px 180px",
          }}
        />
      ) : null}
    </div>
  );
}
