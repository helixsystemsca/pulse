"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { motionTransition } from "@/lib/motion";
import { cn } from "@/lib/cn";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Max vertical nudge on reveal */
  y?: number;
  once?: boolean;
};

/**
 * Fade + slight translate when entering the viewport (IntersectionObserver).
 * Respects Pulse reduced-motion preference (user toggle + `prefers-reduced-motion`).
 */
export function ScrollReveal({ children, className, y = 10, once = true }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const { reduced } = useReducedEffects();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, reduced]);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={motionTransition.medium}
    >
      {children}
    </motion.div>
  );
}
