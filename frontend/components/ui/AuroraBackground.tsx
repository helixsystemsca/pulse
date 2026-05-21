"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useReducedEffects } from "@/hooks/useReducedEffects";
import { cn } from "@/lib/cn";

const NOISE_TILE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E")`;

/** Bright shallow-water palette */
const OCEAN = {
  surface: "#f6fcff",
  shallow: "#e2f7f6",
  mid: "#b8ebe4",
  deep: "#7fd4c8",
  verdigris: "#1ea896",
  aqua: "#8ee4d8",
  foam: "#ffffff",
} as const;

type AuroraBlobConfig = {
  id: string;
  className: string;
  parallax: number;
  duration: number;
  drift: { x: number[]; y: number[] };
  rotate?: number[];
};

const BLOBS: AuroraBlobConfig[] = [
  {
    id: "aqua-nw",
    className: `left-[-18%] top-[-14%] h-[min(54rem,72vh)] w-[min(54rem,68vw)] bg-[radial-gradient(circle_at_38%_40%,color-mix(in_srgb,${OCEAN.aqua}_85%,white),color-mix(in_srgb,${OCEAN.verdigris}_35%,transparent)_52%,transparent_70%)]`,
    parallax: 32,
    duration: 16,
    drift: { x: [0, 120, -80, 40, 0], y: [0, 70, -50, 30, 0] },
    rotate: [0, 8, -5, 0],
  },
  {
    id: "cyan-ne",
    className:
      "right-[-16%] top-[-2%] h-[min(46rem,62vh)] w-[min(48rem,58vw)] bg-[radial-gradient(circle_at_62%_38%,rgba(210,245,255,0.9),rgba(142,228,220,0.45)_50%,transparent_68%)]",
    parallax: 38,
    duration: 18,
    drift: { x: [0, -100, 60, -40, 0], y: [0, 55, -70, 25, 0] },
    rotate: [0, -6, 4, 0],
  },
  {
    id: "teal-center",
    className: `left-[18%] top-[36%] h-[min(42rem,56vh)] w-[min(48rem,62vw)] bg-[radial-gradient(circle_at_50%_48%,color-mix(in_srgb,${OCEAN.verdigris}_50%,white),rgba(130,220,210,0.35)_56%,transparent_72%)]`,
    parallax: 26,
    duration: 20,
    drift: { x: [0, 90, -110, 50, 0], y: [0, -60, 75, -35, 0] },
  },
  {
    id: "blue-depth-sw",
    className:
      "bottom-[-18%] left-[-2%] h-[min(50rem,64vh)] w-[min(52rem,68vw)] bg-[radial-gradient(circle_at_44%_58%,rgba(120,200,230,0.55),rgba(46,150,170,0.25)_52%,transparent_70%)]",
    parallax: 28,
    duration: 17,
    drift: { x: [0, 70, -95, 55, 0], y: [0, -75, 45, -30, 0] },
  },
  {
    id: "foam-se",
    className:
      "bottom-[-6%] right-[-12%] h-[min(40rem,52vh)] w-[min(44rem,54vw)] bg-[radial-gradient(circle_at_58%_52%,rgba(255,255,255,0.95),rgba(142,228,220,0.45)_54%,transparent_70%)]",
    parallax: 34,
    duration: 19,
    drift: { x: [0, -85, 95, -45, 0], y: [0, 40, -55, 28, 0] },
  },
];

const PARALLAX_SPRING = { stiffness: 52, damping: 26, mass: 0.7 };

const CURRENT_LAYERS = [
  {
    className:
      "left-[-30%] top-[18%] h-[38%] w-[160%] rotate-[-8deg] bg-[linear-gradient(92deg,transparent_0%,rgba(255,255,255,0.5)_22%,rgba(186,240,255,0.35)_42%,rgba(255,255,255,0.45)_58%,transparent_78%)]",
    duration: 11,
    x: ["-8%", "14%", "-6%"],
    y: [0, 28, -18, 0],
  },
  {
    className:
      "left-[-25%] top-[48%] h-[32%] w-[150%] rotate-[6deg] bg-[linear-gradient(88deg,transparent_5%,rgba(142,228,220,0.4)_30%,rgba(255,255,255,0.38)_50%,transparent_75%)]",
    duration: 13,
    x: ["10%", "-12%", "8%"],
    y: [0, -32, 22, 0],
  },
  {
    className:
      "left-[-20%] top-[62%] h-[28%] w-[140%] rotate-[-4deg] bg-[linear-gradient(95deg,transparent_0%,rgba(110,210,200,0.32)_35%,rgba(240,253,255,0.42)_55%,transparent_80%)]",
    duration: 15,
    x: ["-6%", "10%", "-4%"],
    y: [0, 24, -16, 0],
  },
] as const;

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
      className={cn("absolute rounded-full blur-[64px] will-change-transform sm:blur-[80px]", config.className)}
      style={{ x: parallaxX, y: parallaxY }}
      aria-hidden
    >
      <motion.div
        className="h-full w-full"
        initial={false}
        animate={
          animate
            ? {
                x: config.drift.x,
                y: config.drift.y,
                rotate: config.rotate ?? 0,
              }
            : undefined
        }
        transition={
          animate
            ? {
                duration: config.duration,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : undefined
        }
      />
    </motion.div>
  );
}

function WaterCurrents({ animate }: { animate: boolean }) {
  return (
    <>
      {CURRENT_LAYERS.map((layer, i) => (
        <motion.div
          key={i}
          className={cn("absolute blur-[28px] will-change-transform", layer.className)}
          initial={false}
          animate={
            animate
              ? {
                  x: layer.x,
                  y: layer.y,
                  opacity: [0.45, 0.75, 0.5, 0.7, 0.45],
                }
              : { opacity: 0.55 }
          }
          transition={
            animate
              ? {
                  duration: layer.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : undefined
          }
          aria-hidden
        />
      ))}
    </>
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
  const glintX = useTransform(smoothX, (v) => v * 48);
  const glintY = useTransform(smoothY, (v) => v * 32);
  const glint2X = useTransform(smoothX, (v) => v * -40);
  const glint2Y = useTransform(smoothY, (v) => v * 26);
  const beamX = useTransform(smoothX, (v) => v * -24);
  const beamY = useTransform(smoothY, (v) => v * 16);

  return (
    <>
      <motion.div
        className="absolute inset-0 opacity-[0.72]"
        style={{ x: beamX, y: beamY }}
        initial={false}
        animate={animate ? { opacity: [0.62, 0.88, 0.68] } : undefined}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_48%_at_50%_-6%,rgba(255,255,255,0.98),rgba(230,250,255,0.55)_36%,transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_34%_at_74%_2%,rgba(200,240,255,0.65),transparent_56%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_32%_at_18%_6%,rgba(150,235,225,0.55),transparent_52%)]" />
      </motion.div>

      <motion.div
        className="absolute left-[4%] top-[8%] h-[42%] w-[48%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.75)_0%,rgba(142,228,220,0.28)_40%,transparent_68%)] blur-2xl"
        style={{ x: glintX, y: glintY }}
        initial={false}
        animate={
          animate
            ? {
                opacity: [0.4, 0.85, 0.5, 0.78, 0.4],
                scale: [1, 1.12, 0.96, 1.08, 1],
                x: [0, 55, -35, 20, 0],
                y: [0, 30, -25, 15, 0],
              }
            : { opacity: 0.55 }
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="absolute right-[6%] top-[14%] h-[36%] w-[42%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(100,200,230,0.25)_46%,transparent_70%)] blur-3xl"
        style={{ x: glint2X, y: glint2Y }}
        initial={false}
        animate={
          animate
            ? {
                opacity: [0.35, 0.72, 0.42, 0.68, 0.35],
                x: [0, -65, 45, -25, 0],
                y: [0, 40, -30, 18, 0],
              }
            : { opacity: 0.5 }
        }
        transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Caustic streaks — travel like rippling light */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute h-[14%] w-[120%] bg-[linear-gradient(100deg,transparent_0%,rgba(255,255,255,0.55)_40%,rgba(186,240,255,0.4)_55%,transparent_85%)] blur-lg"
          style={{ top: `${22 + i * 18}%`, rotate: -6 + i * 5 }}
          initial={false}
          animate={
            animate
              ? {
                  x: ["-18%", "22%", "-12%"],
                  opacity: [0.15, 0.55, 0.22, 0.48, 0.15],
                }
              : { opacity: 0.3 }
          }
          transition={{
            duration: 9 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 1.2,
          }}
          aria-hidden
        />
      ))}

      <motion.div
        className="absolute inset-x-[-15%] top-[32%] h-[26%] bg-[linear-gradient(102deg,transparent_5%,rgba(255,255,255,0.58)_30%,rgba(200,245,255,0.42)_48%,rgba(255,255,255,0.5)_62%,transparent_90%)] blur-2xl"
        initial={false}
        animate={
          animate
            ? {
                x: [-180, 220, -140, 160, -180],
                opacity: [0.3, 0.65, 0.38, 0.58, 0.3],
              }
            : { opacity: 0.4 }
        }
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        className="absolute inset-x-0 top-0 h-[min(32rem,42vh)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(224,247,252,0.5)_38%,transparent_100%)]"
        initial={false}
        animate={animate ? { opacity: [0.72, 0.95, 0.78, 0.92, 0.72] } : { opacity: 0.85 }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    </>
  );
}

export type AuroraBackgroundProps = {
  className?: string;
};

/**
 * Bright undersea aurora — visible current drift, moving light caustics, cursor parallax.
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
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${OCEAN.surface} 0%, ${OCEAN.shallow} 28%, ${OCEAN.mid} 62%, color-mix(in srgb, ${OCEAN.deep} 75%, ${OCEAN.verdigris}) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_75%_at_50%_108%,color-mix(in_srgb,#4aab9e_28%,transparent),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(255,255,255,0.55),transparent_62%)]" />

      {BLOBS.map((blob) => (
        <AuroraBlob key={blob.id} config={blob} smoothX={smoothX} smoothY={smoothY} animate={animate} />
      ))}

      <WaterCurrents animate={animate} />

      <SurfaceReflections smoothX={smoothX} smoothY={smoothY} animate={animate} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(76,96,133,0.04)_80%,rgba(60,90,110,0.1)_100%)]" />

      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_TILE,
          backgroundSize: "200px 200px",
        }}
      />
    </div>
  );
}
