"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { buttonVariants, type ButtonIntent, type ButtonSurface } from "@/styles/button-variants";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Semantic fill / emphasis (maps to CVA `intent`). */
  variant?: ButtonIntent;
  /** `light` = black border + rules for white/grey/teal panels; `dark` = white border on dusk/black. */
  surface?: ButtonSurface;
  children: ReactNode;
  className?: string;
};

export function Button({
  variant = "primary",
  surface = "light",
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ surface, intent: variant }), className)} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonIntent;
  surface?: ButtonSurface;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ href, variant = "primary", surface = "light", children, className = "", ...props }: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ surface, intent: variant }), className)} {...props}>
      {children}
    </Link>
  );
}
