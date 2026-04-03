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
      className={`mx-auto w-[90%] max-w-[1600px] px-4 py-6 sm:px-5 sm:py-8 ${className}`.trim()}
      data-layout="main-content"
    >
      {children}
    </div>
  );
}
