"use client";

import { motion } from "framer-motion";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { modalBackdropVariants, motionTransition } from "@/lib/motion";
import { cn } from "@/lib/cn";

type AnimatedBackdropProps = {
  onClick?: () => void;
  className?: string;
  dim?: "light" | "medium";
};

export function AnimatedBackdrop({ onClick, className, dim = "medium" }: AnimatedBackdropProps) {
  const { reduced } = useReducedEffects();
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      aria-label="Dismiss"
      className={cn(
        "absolute inset-0 z-0 backdrop-blur-[3px]",
        dim === "light" ? "bg-black/25" : "bg-black/35",
        className,
      )}
      variants={modalBackdropVariants}
      initial={reduced ? "show" : "hidden"}
      animate="show"
      exit={reduced ? "show" : "hidden"}
      transition={motionTransition.modal}
      onClick={onClick}
    />
  );
}
