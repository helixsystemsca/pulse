import type { ReactNode } from "react";

/**
 * Standard content width for authenticated Pulse pages: 90% viewport, capped, centered.
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
      className={`mx-auto w-[min(100%,92vw)] max-w-[1360px] px-4 py-5 sm:px-5 sm:py-6 md:py-7 ${className}`.trim()}
      data-layout="main-content"
    >
      {children}
    </div>
  );
}
