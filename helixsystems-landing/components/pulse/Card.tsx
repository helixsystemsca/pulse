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
      className={`app-glass-card rounded-2xl text-gray-900 transition-shadow duration-200 ease-in-out hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)] dark:text-gray-100 dark:hover:shadow-[0_14px_44px_rgba(0,0,0,0.48)] ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
