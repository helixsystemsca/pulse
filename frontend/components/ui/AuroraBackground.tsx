"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

const NOISE_TILE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E")`;

/** Panorama ocean palette — light undersea, not deep navy. */
const OCEAN = {
  surface: "#eef9fc",
  shallow: "#d4f1f0",
  mid: "#a8e6df",
  deep: "#6ec9be",
  verdigris: "#1ea896",
  aqua: "#7dd9ce",
  foam: "#f0fdff",
} as const;

type AuroraBlobConfig = {
  id: string;
  className: string;
  parallax: number;
  duration: number;
  drift: { x: number[]; y: number[] };
};

const BLOBS: AuroraBlobConfig[] = [
  {
    id: "aqua-nw",
    className: `left-[-14%] top-[-10%] h-[min(50rem,66vh)] w-[min(50rem,60vw)] bg-[radial-gradient(circle_at_38%_40%,color-mix(in_srgb,${OCEAN.aqua}_72%,white),color-mix(in_srgb,${OCEAN.verdigris}_28%,transparent)_55%,transparent_72%)]`,
    parallax: 14,
    duration: 36,
    drift: { x: [0, 38, -16, 0], y: [0, 24, -10, 0] },
  },
  {
    id: "cyan-ne",
    className:
      "right-[-12%] top-[2%] h-[min(42rem,56vh)] w-[min(44rem,52vw)] bg-[radial-gradient(circle_at_62%_38%,rgba(186,230,253,0.75),rgba(125,217,206,0.35)_52%,transparent_70%)]",
    parallax: 20,
    duration: 40,
    drift: { x: [0, -32, 12, 0], y: [0, 18, -14, 0] },
  },
  {
    id: "teal-center",
    className: `left-[24%] top-[42%] h-[min(38rem,50vh)] w-[min(44rem,56vw)] bg-[radial-gradient(circle_at_50%_48%,color-mix(in_srgb,${OCEAN.verdigris}_42%,${OCEAN.shallow}),rgba(110,201,190,0.2)_58%,transparent_74%)]`,
    parallax: 10,
    duration: 44,
    drift: { x: [0, 26, -20, 0], y: [0, -18, 16, 0] },
  },
  {
    id: "blue-depth-sw",
    className:
      "bottom-[-16%] left-[4%] h-[min(46rem,58vh)] w-[min(48rem,62vw)] bg-[radial-gradient(circle_at_44%_58%,rgba(94,178,214,0.45),rgba(30,120,142,0.18)_54%,transparent_72%)]",
    parallax: 12,
    duration: 38,
    drift: { x: [0, 22, -28, 0], y: [0, -22, 8, 0] },
  },
  {
    id: "foam-se",
    className:
      "bottom-[-4%] right-[-8%] h-[min(36rem,46vh)] w-[min(40rem,48vw)] bg-[radial-gradient(circle_at_58%_52%,rgba(240,253,255,0.85),rgba(125,217,206,0.35)_56%,transparent_72%)]",
    parallax: 16,
    duration: 42,
    drift: { x: [0, -28, 18, 0], y: [0, 14, -18, 0] },
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
      className={cn("absolute rounded-full blur-[72px] will-change-transform sm:blur-[88px]", config.className)}
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

function SurfaceReflections({
  smoothX,
  smoothY,
  animate,
}: {
  smoothX: ReturnType<typeof useSpring>;
  smoothY: ReturnType<typeof useSpring>;
  animate: boolean;
}) {
  const glintX = useTransform(smoothX, (v) => v * 28);
  const glintY = useTransform(smoothY, (v) => v * 18);
  const glint2X = useTransform(smoothX, (v) => v * -22);
  const glint2Y = useTransform(smoothY, (v) => v * 14);
  const beamX = useTransform(smoothX, (v) => v * -12);
  const beamY = useTransform(smoothY, (v) => v * 8);

  return (
    <>
      {/* Sunlight through water — top-down shafts */}
      <motion.div
        className="absolute inset-0 opacity-[0.55]"
        style={{ x: beamX, y: beamY }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_42%_at_50%_-8%,rgba(255,255,255,0.92),rgba(224,247,252,0.45)_38%,transparent_68%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_30%_at_72%_0%,rgba(186,230,253,0.5),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_28%_at_22%_4%,rgba(125,217,206,0.42),transparent_55%)]" />
      </motion.div>

      {/* Slow-moving caustic glints */}
      <motion.div
        className="absolute left-[8%] top-[12%] h-[38%] w-[44%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.55)_0%,rgba(125,217,206,0.2)_42%,transparent_70%)] blur-2xl"
        style={{ x: glintX, y: glintY }}
        initial={false}
        animate={animate ? { opacity: [0.35, 0.62, 0.4], scale: [1, 1.06, 1] } : { opacity: 0.45 }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute right-[10%] top-[18%] h-[32%] w-[36%] rounded-full bg-[radial-gradient(circle,rgba(240,253,255,0.7)_0%,rgba(94,178,214,0.18)_48%,transparent_72%)] blur-3xl"
        style={{ x: glint2X, y: glint2Y }}
        initial={false}
        animate={animate ? { opacity: [0.28, 0.52, 0.32], x: [0, 24, -12, 0] } : { opacity: 0.38 }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Horizontal shimmer band — underwater light ripple */}
      <motion.div
        className="absolute left-[-10%] right-[-10%] top-[28%] h-[22%] bg-[linear-gradient(105deg,transparent_8%,rgba(255,255,255,0.42)_32%,rgba(186,230,253,0.28)_48%,rgba(255,255,255,0.35)_62%,transparent_88%)] blur-xl"
        initial={false}
        animate={
          animate
            ? {
                x: ["-4%", "6%", "-2%"],
                opacity: [0.22, 0.38, 0.26],
              }
            : { opacity: 0.28 }
        }
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Subtle wave highlight near “surface” */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[min(28rem,38vh)] bg-[linear-gradient(180deg,rgba(255,255,255,0.75)_0%,rgba(224,247,252,0.35)_42%,transparent_100%)]"
        initial={false}
        animate={animate ? { opacity: [0.65, 0.85, 0.7] } : { opacity: 0.75 }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    </>
  );
}

export type AuroraBackgroundProps = {
  className?: string;
};

/**
 * Light undersea aurora for auth shells — aqua/teal depth, surface reflections, soft parallax.
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

  const animate = !reduced;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Shallow water column */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${OCEAN.surface} 0%, ${OCEAN.shallow} 32%, ${OCEAN.mid} 68%, color-mix(in srgb, ${OCEAN.deep} 88%, ${OCEAN.verdigris}) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_110%,color-mix(in_srgb,#3d8f9e_35%,transparent),transparent_58%)]" />

      {BLOBS.map((blob) => (
        <AuroraBlob
          key={blob.id}
          config={blob}
          smoothX={smoothX}
          smoothY={smoothY}
          animate={animate}
        />
      ))}

      <SurfaceReflections smoothX={smoothX} smoothY={smoothY} animate={animate} />

      {/* Soft edge depth — light vignette only */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(76,96,133,0.06)_78%,rgba(60,90,110,0.14)_100%)]" />

      <div
        className="absolute inset-0 opacity-[0.028] mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_TILE,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}
