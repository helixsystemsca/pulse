"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  buttonVariants,
  type ButtonIntent,
  type ButtonSurface,
  type ButtonSurfaceContext,
} from "@/styles/button-variants";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Semantic fill / emphasis (maps to `intent`). */
  variant?: ButtonIntent;
  /** `light` = light-surface rules (§4); `dark` = transparent/dark fill, white border/text (§4). */
  surface?: ButtonSurface;
  /** Parent panel hue — when it matches the button color, a darker contrast fill is applied automatically. */
  surfaceColor?: ButtonSurfaceContext;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  surface = "light",
  surfaceColor,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ surface, intent: variant, surfaceColor }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonIntent;
  surface?: ButtonSurface;
  surfaceColor?: ButtonSurfaceContext;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({
  href,
  variant = "primary",
  surface = "light",
  surfaceColor,
  children,
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ surface, intent: variant, surfaceColor }), className)} {...props}>
      {children}
    </Link>
  );
}
