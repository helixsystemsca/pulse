import type { ReactNode } from "react";

type SectionWrapperProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Applied to inner max-w-7xl container */
  innerClassName?: string;
};

export function SectionWrapper({
  id,
  children,
  className = "",
  innerClassName = "",
}: SectionWrapperProps) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      <div className={`mx-auto max-w-7xl px-5 sm:px-6 ${innerClassName}`}>{children}</div>
    </section>
  );
}
