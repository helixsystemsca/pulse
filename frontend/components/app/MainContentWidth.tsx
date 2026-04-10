import type { ReactNode } from "react";

/**
 * Authenticated Pulse pages: fill the main column edge-to-edge with small uniform inset.
 */
export function MainContentWidth({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      id="layout-wrapper"
      className={`box-border flex min-h-0 w-full min-w-0 flex-1 flex-col p-4 ${className}`.trim()}
      data-layout="main-content"
    >
      {children}
    </div>
  );
}
