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
      <div className="flex items-center justify-center">
        <LoginComingSoonFeaturesCard playAnimation className="coming-soon-card--embedded" />
      </div>
    );
  }

  return (
    <motion.div
      className="flex items-center justify-start max-md:justify-center"
      initial="hidden"
      animate="visible"
      variants={loginComingSoonSlideVariants}
      transition={loginComingSoonSlideTransition}
    >
      <LoginComingSoonFeaturesCard playAnimation className="coming-soon-card--embedded" />
    </motion.div>
  );
}
