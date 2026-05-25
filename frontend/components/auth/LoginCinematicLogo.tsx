"use client";

import Image from "next/image";
import { LayoutGroup, motion } from "framer-motion";
import {
  loginHeroLogoTransition,
  loginHeroLogoVariants,
  loginLayoutLogoTransition,
  loginLayoutLogoVariants,
} from "@/lib/auth/login-intro-motion";
import { cn } from "@/lib/cn";

const LOGO_SRC = "/images/panoramalogo2.png";

type Props = {
  showHero: boolean;
  showLayout: boolean;
  layoutClassName?: string;
};

export function LoginCinematicLogo({ showHero, showLayout, layoutClassName }: Props) {
  return (
    <LayoutGroup id="login-panorama-logo">
      {showHero ? (
        <motion.div
          layoutId="panorama-login-logo"
          className="pointer-events-none fixed inset-0 z-[18] flex items-center justify-center"
          initial="hidden"
          animate="focus"
          variants={loginHeroLogoVariants}
          transition={loginHeroLogoTransition}
        >
          <div
            className="relative w-[min(92vw,52rem)] max-w-[95vw] sm:w-[min(88vw,56rem)]"
            style={{ aspectRatio: "2.4 / 1" }}
          >
            <div
              className="pointer-events-none absolute inset-[-12%] rounded-[40%] bg-[radial-gradient(ellipse_at_center,rgba(86,201,217,0.22)_0%,transparent_68%)] blur-2xl"
              aria-hidden
            />
            <Image
              src={LOGO_SRC}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-contain object-center"
              aria-hidden
            />
          </div>
        </motion.div>
      ) : null}

      {showLayout ? (
        <motion.div
          layoutId="panorama-login-logo"
          className={cn("relative mx-auto flex w-full justify-center", layoutClassName)}
          initial={false}
          animate="visible"
          variants={loginLayoutLogoVariants}
          transition={loginLayoutLogoTransition}
        >
          <div className="relative h-[9.25rem] w-[min(22rem,calc(100vw-2rem))] shrink-0 sm:h-[11rem] sm:w-[min(26rem,calc(100vw-2rem))] md:h-[12.5rem] md:w-[min(30rem,calc(100vw-2.5rem))]">
            <Image
              src={LOGO_SRC}
              alt="Panorama"
              fill
              priority
              sizes="(max-width: 640px) 90vw, (max-width: 768px) 26rem, 30rem"
              className="object-contain object-center"
            />
          </div>
        </motion.div>
      ) : null}
    </LayoutGroup>
  );
}
