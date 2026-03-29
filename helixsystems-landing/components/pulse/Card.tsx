import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** default: comfortable p-6 */
  padding?: "md" | "lg";
};

const paddingClass = {
  md: "p-5",
  lg: "p-6",
} as const;

export function Card({ children, className = "", padding = "lg" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-pulse-border bg-white shadow-md ring-1 ring-slate-900/[0.04] transition-shadow duration-200 ease-in-out hover:shadow-lg ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
