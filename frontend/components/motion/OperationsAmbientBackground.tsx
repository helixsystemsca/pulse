"use client";

import { motion } from "framer-motion";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { motionDuration } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Ultra-subtle drifting mesh + glow for dashboard-class pages.
 * transform/opacity only; disabled when reduced motion is on.
 */
export function OperationsAmbientBackground({ className }: { className?: string }) {
  const { reduced } = useReducedEffects();
  const loop = motionDuration.ambient;

  if (reduced) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden opacity-[0.045] dark:opacity-[0.07]",
          className,
        )}
        aria-hidden
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_20%_0%,color-mix(in_srgb,var(--ds-accent)_22%,transparent),transparent_55%),radial-gradient(ellipse_100%_70%_at_100%_40%,color-mix(in_srgb,var(--ds-accent)_14%,transparent),transparent_50%)]"
          style={{ transform: "translateZ(0)" }}
        />
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <motion.div
        className="absolute -left-[18%] -top-[22%] h-[78%] w-[72%] rounded-full bg-[radial-gradient(circle_at_40%_40%,color-mix(in_srgb,var(--ds-accent)_18%,transparent),transparent_68%)] opacity-[0.07] blur-3xl dark:opacity-[0.09]"
        initial={false}
        animate={{ x: [0, 18, -8, 0], y: [0, 12, -6, 0] }}
        transition={{ duration: loop, repeat: Infinity, ease: "linear" }}
        style={{ willChange: "transform" }}
      />
      <motion.div
        className="absolute -bottom-[26%] -right-[12%] h-[70%] w-[68%] rounded-full bg-[radial-gradient(circle_at_60%_55%,color-mix(in_srgb,var(--ds-text-primary)_10%,transparent),transparent_65%)] opacity-[0.06] blur-3xl dark:opacity-[0.08]"
        initial={false}
        animate={{ x: [0, -22, 10, 0], y: [0, -14, 8, 0] }}
        transition={{ duration: loop * 1.15, repeat: Infinity, ease: "linear" }}
        style={{ willChange: "transform" }}
      />
      <motion.div
        className="absolute left-[35%] top-[40%] h-[42%] w-[48%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ds-accent)_8%,transparent),transparent_72%)] opacity-[0.05] blur-2xl"
        initial={false}
        animate={{ opacity: [0.04, 0.07, 0.045] }}
        transition={{ duration: loop * 0.55, repeat: Infinity, ease: "easeInOut" }}
        style={{ willChange: "opacity", transform: "translateZ(0)" }}
      />
      {/* Ultra-light grain — data URI noise tile */}
      <div
        className="absolute inset-0 opacity-[0.018] mix-blend-soft-light dark:opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
          backgroundSize: "220px 220px",
        }}
      />
    </div>
  );
}
