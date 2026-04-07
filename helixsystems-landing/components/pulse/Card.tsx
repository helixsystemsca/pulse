import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** default: comfortable p-6 */
  padding?: "md" | "lg";
  /** Whole card is a control (e.g. wraps a link). Default: static surface, no hover lift. */
  interactive?: boolean;
};

const paddingClass = {
  md: "p-5",
  lg: "p-6",
} as const;

const interactiveShadow =
  "cursor-pointer transition-shadow duration-200 ease-out hover:shadow-[0_4px_18px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.28),0_1px_4px_rgba(0,0,0,0.18)]";

export function Card({
  children,
  className = "",
  padding = "lg",
  interactive = false,
}: CardProps) {
  return (
    <div
      className={`app-glass-card rounded-md text-gray-900 dark:text-gray-100 ${interactive ? interactiveShadow : ""} ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
