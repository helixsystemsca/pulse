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
      className={`rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-md ring-1 ring-slate-900/[0.04] transition-shadow duration-200 ease-in-out hover:shadow-lg dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:ring-white/[0.06] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
