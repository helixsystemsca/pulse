import type { ReactNode } from "react";

type SectionWrapperProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Applied to inner max-w-7xl container */
  innerClassName?: string;
  /** Subtle separator under the section on small screens only */
  showMobileSeparator?: boolean;
};

export function SectionWrapper({
  id,
  children,
  className = "",
  innerClassName = "",
  showMobileSeparator = false,
}: SectionWrapperProps) {
  return (
    <section
      id={id}
      className={`${showMobileSeparator ? "py-12 md:py-24" : "py-16 md:py-24"} ${className}`}
    >
      <div className={`mx-auto max-w-7xl px-5 sm:px-6 ${innerClassName}`}>{children}</div>
      {showMobileSeparator ? (
        <div className="mx-auto flex max-w-7xl justify-center px-5 py-6 sm:px-6 md:hidden" aria-hidden>
          <div className="flex w-full max-w-md items-center gap-3 opacity-[0.85]">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-400/40 to-slate-400/15" />
            <span className="inline-flex h-1.5 w-1.5 rotate-45 rounded-[1px] bg-slate-400/45 ring-1 ring-slate-300/35 shadow-sm shadow-slate-400/20" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-400/40 to-slate-400/15" />
          </div>
        </div>
      ) : null}
    </section>
  );
}
