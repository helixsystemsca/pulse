"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { UI } from "@/styles/ui";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  children: ReactNode;
  className?: string;
};

export function Button({ variant = "primary", children, className = "", ...props }: ButtonProps) {
  const variantClass = variant === "secondary" ? UI.button.secondary : UI.button.primary;

  return (
    <button className={`${UI.button.base} ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ href, variant = "primary", children, className = "", ...props }: ButtonLinkProps) {
  const variantClass = variant === "secondary" ? UI.button.secondary : UI.button.primary;

  return (
    <Link
      href={href}
      className={`${UI.button.base} ${variantClass} inline-flex items-center justify-center ${className}`.trim()}
      {...props}
    >
      {children}
    </Link>
  );
}
