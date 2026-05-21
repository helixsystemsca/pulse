"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

const NOISE_TILE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

type AuroraBlobConfig = {
  id: string;
  className: string;
  parallax: number;
  duration: number;
  drift: { x: number[]; y: number[] };
};

const BLOBS: AuroraBlobConfig[] = [
  {
    id: "indigo-nw",
    className:
      "left-[-12%] top-[-8%] h-[min(52rem,68vh)] w-[min(52rem,62vw)] bg-[radial-gradient(circle_at_40%_38%,rgba(79,70,229,0.38),rgba(30,27,75,0.12)_52%,transparent_72%)]",
    parallax: 18,
    duration: 34,
    drift: { x: [0, 42, -18, 0], y: [0, 28, -12, 0] },
  },
  {
    id: "cyan-ne",
    className:
      "right-[-10%] top-[4%] h-[min(44rem,58vh)] w-[min(44rem,54vw)] bg-[radial-gradient(circle_at_58%_42%,rgba(34,211,238,0.28),rgba(14,116,144,0.1)_55%,transparent_72%)]",
    parallax: 24,
    duration: 38,
    drift: { x: [0, -36, 14, 0], y: [0, 22, -16, 0] },
  },
  {
    id: "blue-center",
    className:
      "left-[28%] top-[38%] h-[min(40rem,52vh)] w-[min(46rem,58vw)] bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.22),rgba(30,58,138,0.08)_58%,transparent_74%)]",
    parallax: 12,
    duration: 42,
    drift: { x: [0, 28, -22, 0], y: [0, -20, 18, 0] },
  },
  {
    id: "navy-sw",
    className:
      "bottom-[-14%] left-[8%] h-[min(48rem,60vh)] w-[min(50rem,64vw)] bg-[radial-gradient(circle_at_42%_62%,rgba(30,58,95,0.42),rgba(15,23,42,0.16)_54%,transparent_72%)]",
    parallax: 16,
    duration: 36,
    drift: { x: [0, 24, -30, 0], y: [0, -26, 10, 0] },
  },
  {
    id: "indigo-se",
    className:
      "bottom-[-6%] right-[-6%] h-[min(38rem,48vh)] w-[min(42rem,50vw)] bg-[radial-gradient(circle_at_60%_55%,rgba(67,56,202,0.26),rgba(23,37,84,0.1)_56%,transparent_70%)]",
    parallax: 20,
    duration: 40,
    drift: { x: [0, -32, 20, 0], y: [0, 18, -22, 0] },
  },
];

const PARALLAX_SPRING = { stiffness: 38, damping: 32, mass: 0.85 };

function AuroraBlob({
  config,
  smoothX,
  smoothY,
  animate,
}: {
  config: AuroraBlobConfig;
  smoothX: ReturnType<typeof useSpring>;
  smoothY: ReturnType<typeof useSpring>;
  animate: boolean;
}) {
  const parallaxX = useTransform(smoothX, (v) => v * config.parallax);
  const parallaxY = useTransform(smoothY, (v) => v * config.parallax);

  return (
    <motion.div
      className={cn("absolute rounded-full blur-[88px] will-change-transform sm:blur-[100px]", config.className)}
      style={{ x: parallaxX, y: parallaxY }}
      aria-hidden
    >
      <motion.div
        className="h-full w-full"
        initial={false}
        animate={animate ? { x: config.drift.x, y: config.drift.y } : undefined}
        transition={
          animate
            ? { duration: config.duration, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }
            : undefined
        }
      />
    </motion.div>
  );
}

export type AuroraBackgroundProps = {
  className?: string;
};

/**
 * Full-viewport aurora mesh for auth / marketing shells — slow gradients, soft parallax, vignette + grain.
 * Pointer-events none; place behind content (`z-0`) with foreground at `z-10+`.
 */
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  const { reduced } = useReducedEffects();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, PARALLAX_SPRING);
  const smoothY = useSpring(mouseY, PARALLAX_SPRING);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      mouseX.set((e.clientX / w - 0.5) * 2);
      mouseY.set((e.clientY / h - 0.5) * 2);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY, reduced]);

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Deep navy base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#060b14] via-[#0b1224] to-[#070d18]" />

      {/* Soft horizon glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_100%,rgba(30,58,95,0.35),transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />

      {BLOBS.map((blob) => (
        <AuroraBlob
          key={blob.id}
          config={blob}
          smoothX={smoothX}
          smoothY={smoothY}
          animate={!reduced}
        />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,8,18,0.55)_72%,rgba(2,5,12,0.88)_100%)]" />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_TILE,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}
