import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type CardVariant = "primary" | "secondary" | "elevated";

export type CardProps = {
  children: ReactNode;
  className?: string;
  /** default: comfortable p-6 */
  padding?: "none" | "md" | "lg";
  /** Surface tier — maps to design-system card tokens in globals.css */
  variant?: CardVariant;
  /** Whole card is a control (e.g. wraps a link). Default: static surface, no hover lift. */
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

const paddingClass = {
  none: "",
  md: "p-5",
  lg: "p-6",
} as const;

const variantClass: Record<CardVariant, string> = {
  primary: "ds-card-primary text-ds-foreground",
  secondary: "ds-card-secondary text-ds-foreground",
  elevated: "ds-card-elevated text-ds-foreground",
};

const interactiveClass = "cursor-pointer";

export function Card({
  children,
  className = "",
  padding = "lg",
  variant = "primary",
  interactive = false,
  ...rest
}: CardProps) {
  const showPointer = interactive || typeof rest.onClick === "function";
  return (
    <div
      className={`${variantClass[variant]} ${showPointer ? interactiveClass : ""} ${paddingClass[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
