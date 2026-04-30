import type { ReactNode } from "react";

type PageBodyProps = {
  children: ReactNode;
  className?: string;
};

export function PageBody({ children, className = "" }: PageBodyProps) {
  return <div className={["w-full space-y-6", className].filter(Boolean).join(" ")}>{children}</div>;
}

