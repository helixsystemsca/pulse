import type { ReactNode } from "react";

import { UI } from "@/styles/ui";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${UI.card} ${className}`.trim()}>{children}</div>;
}
