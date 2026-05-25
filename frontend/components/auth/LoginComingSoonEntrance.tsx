"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LoginComingSoonFeaturesCard } from "@/components/auth/LoginComingSoonFeaturesCard";
import {
  loginComingSoonSlideTransition,
  loginComingSoonSlideVariants,
} from "@/lib/auth/login-intro-motion";

type Props = {
  visible: boolean;
};

/**
 * Slides the docked card in from the left. Motion is on this wrapper so `position: fixed`
 * on the card is not broken by a transformed ancestor.
 */
export function LoginComingSoonEntrance({ visible }: Props) {
  const reducedMotion = useReducedMotion();

  if (!visible) return null;

  if (reducedMotion) {
    return (
      <div className="fixed left-0 top-1/2 z-[15] -translate-y-1/2">
        <LoginComingSoonFeaturesCard playAnimation className="coming-soon-card--embedded" />
      </div>
    );
  }

  return (
    <motion.div
      className="fixed left-0 top-1/2 z-[15] -translate-y-1/2 max-md:relative max-md:top-auto max-md:left-auto max-md:z-10 max-md:mx-auto max-md:mb-5 max-md:translate-y-0"
      initial="hidden"
      animate="visible"
      variants={loginComingSoonSlideVariants}
      transition={loginComingSoonSlideTransition}
    >
      <LoginComingSoonFeaturesCard playAnimation className="coming-soon-card--embedded" />
    </motion.div>
  );
}
