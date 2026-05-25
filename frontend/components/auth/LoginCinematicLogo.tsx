"use client";

import Image from "next/image";
import { LayoutGroup, motion } from "framer-motion";
import {
  loginLogoEmergenceTransition,
  loginLogoSettleTransition,
  type LoginIntroStage,
} from "@/lib/auth/login-intro-motion";
import { cn } from "@/lib/cn";

const LOGO_SRC = "/images/panoramalogo2.png";

const HERO_BOX =
  "relative w-[min(92vw,52rem)] max-w-[95vw] sm:w-[min(88vw,56rem)] will-change-transform";

const LAYOUT_BOX =
  "relative h-[9.25rem] w-[min(22rem,calc(100vw-2rem))] shrink-0 sm:h-[11rem] sm:w-[min(26rem,calc(100vw-2rem))] md:h-[12.5rem] md:w-[min(30rem,calc(100vw-2.5rem))] will-change-transform";

type Props = {
  stage: LoginIntroStage;
  layoutClassName?: string;
};

export function LoginCinematicLogo({ stage, layoutClassName }: Props) {
  const isIntro = stage === "intro";
  const isSettling = stage === "logo-settle";
  const inFlow = stage !== "intro";

  return (
    <LayoutGroup id="login-panorama-logo">
      <div
        className={cn(
          "flex w-full justify-center",
          !inFlow && "pointer-events-none min-h-[9.25rem] sm:min-h-[11rem] md:min-h-[12.5rem]",
          layoutClassName,
        )}
        style={{ perspective: 1400 }}
      >
        <motion.div
          layoutId="panorama-login-logo"
          className={cn(
            "flex items-center justify-center",
            inFlow ? "relative mx-auto w-full" : "fixed inset-0 z-[18]",
          )}
          initial={{ opacity: 0.1, scale: 0.32 }}
          animate={{
            opacity: 1,
            scale: isIntro ? 1.1 : 1,
          }}
          transition={
            isIntro
              ? loginLogoEmergenceTransition
              : isSettling
                ? loginLogoSettleTransition
                : { duration: 0.2 }
          }
          style={{ transformOrigin: "center center" }}
        >
          <motion.div
            layout
            className={cn(inFlow ? LAYOUT_BOX : HERO_BOX)}
            style={{ aspectRatio: inFlow ? undefined : "2.4 / 1" }}
            transition={loginLogoSettleTransition}
          >
            <div
              className="pointer-events-none absolute inset-[-10%] rounded-[40%] bg-[radial-gradient(ellipse_at_center,rgba(86,201,217,0.18)_0%,transparent_70%)] opacity-80"
              aria-hidden
            />
            <Image
              src={LOGO_SRC}
              alt={inFlow ? "Panorama" : ""}
              fill
              priority
              sizes={inFlow ? "(max-width: 640px) 90vw, 30rem" : "100vw"}
              className="object-contain object-center [image-rendering:auto]"
              aria-hidden={!inFlow}
            />
          </motion.div>
        </motion.div>
      </div>
    </LayoutGroup>
  );
}
