"use client";

import { motion } from "framer-motion";
import {
  loginScrimTransition,
  loginScrimVariants,
} from "@/lib/auth/login-intro-motion";

type Props = {
  active: boolean;
};

/** Atmospheric dim layer during the brand reveal — background effects remain visible beneath. */
export function LoginIntroAtmosphere({ active }: Props) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[8] bg-[linear-gradient(180deg,rgba(8,18,32,0.42)_0%,rgba(10,22,38,0.28)_45%,rgba(12,26,42,0.18)_100%)]"
      initial={false}
      animate={active ? "intro" : "idle"}
      variants={loginScrimVariants}
      transition={loginScrimTransition}
      aria-hidden
    />
  );
}
