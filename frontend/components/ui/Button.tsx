"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import type { AsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { cn } from "@/lib/cn";
import { buttonVariants, type ButtonIntent, type ButtonSurface } from "@/styles/button-variants";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonIntent;
  surface?: ButtonSurface;
  children: ReactNode;
  className?: string;
  /** When set, shows loading spinner → checkmark (or error shake) on save/submit actions. */
  submitPhase?: AsyncSubmitPhase;
  loadingLabel?: string;
  successSrLabel?: string;
};

export function Button({
  variant = "primary",
  surface = "light",
  children,
  className = "",
  type = "button",
  submitPhase,
  loadingLabel,
  successSrLabel,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  if (submitPhase != null) {
    return (
      <AsyncSubmitButton
        phase={submitPhase}
        intent={variant}
        surface={surface}
        className={className}
        type={type}
        disabled={disabled}
        onClick={onClick}
        loadingLabel={loadingLabel}
        successSrLabel={successSrLabel}
        idleLabel={typeof children === "string" ? children : undefined}
      >
        {children}
      </AsyncSubmitButton>
    );
  }

  return (
    <button
      type={type}
      className={cn(buttonVariants({ surface, intent: variant }), className)}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
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

export function ButtonLink({
  href,
  variant = "primary",
  surface = "light",
  children,
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ surface, intent: variant }), className)} {...props}>
      {children}
    </Link>
  );
}
