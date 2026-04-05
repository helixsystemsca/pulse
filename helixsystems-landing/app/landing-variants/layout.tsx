import Link from "next/link";

const links = [
  { href: "/landing-variants", label: "Index" },
  { href: "/landing-variants/a", label: "A" },
  { href: "/landing-variants/b", label: "B" },
  { href: "/landing-variants/c", label: "C" },
  { href: "/landing-variants/d", label: "D" },
] as const;

export default function LandingVariantsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24">
      {children}
      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-[70] flex justify-center px-4">
        <nav
          aria-label="Landing variant previews"
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_12px_40px_rgba(15,23,42,0.15)] backdrop-blur-md sm:gap-2 sm:px-3 sm:text-xs"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-2.5 py-1 text-slate-700 no-underline transition-colors hover:bg-slate-100 hover:text-slate-900 sm:px-3 font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
