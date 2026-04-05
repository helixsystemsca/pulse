"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pulseApp } from "@/lib/pulse-app";

export type LandingVariantNavPreset = "a" | "b" | "c" | "d";

const presets: Record<
  LandingVariantNavPreset,
  {
    header: string;
    logo: string;
    linkIdle: string;
    linkActive: string;
    mobileBar: string;
    mobileLinkIdle: string;
    mobileLinkActive: string;
    launch: string;
  }
> = {
  a: {
    header:
      "sticky top-0 z-50 border-b border-stone-200/80 bg-[#f7f3eb]/90 backdrop-blur-md",
    logo: "font-headline text-xl font-extrabold tracking-tight text-stone-900 no-underline transition-transform duration-200 hover:scale-[1.02]",
    linkIdle:
      "border-b-2 border-transparent pb-0.5 text-sm font-semibold text-stone-600 no-underline transition-colors duration-200 hover:text-amber-700",
    linkActive:
      "border-b-2 border-amber-600 pb-0.5 text-sm font-semibold text-amber-800 no-underline",
    mobileBar: "flex flex-wrap items-center justify-center gap-4 border-t border-stone-200/60 px-6 py-2 md:hidden",
    mobileLinkIdle:
      "border-b-2 border-transparent pb-0.5 text-xs font-semibold text-stone-600 no-underline transition-colors duration-200 hover:text-amber-700",
    mobileLinkActive:
      "border-b-2 border-amber-600 pb-0.5 text-xs font-semibold text-amber-800 no-underline",
    launch:
      "rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-[#f7f3eb] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md no-underline",
  },
  b: {
    header:
      "sticky top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl",
    logo: "font-headline text-xl font-extrabold tracking-tight text-white no-underline transition-transform duration-200 hover:scale-[1.02]",
    linkIdle:
      "border-b-2 border-transparent pb-0.5 text-sm font-semibold text-slate-300 no-underline transition-colors duration-200 hover:text-cyan-200",
    linkActive:
      "border-b-2 border-cyan-300 pb-0.5 text-sm font-semibold text-white no-underline",
    mobileBar: "flex flex-wrap items-center justify-center gap-4 border-t border-white/10 px-6 py-2 md:hidden",
    mobileLinkIdle:
      "border-b-2 border-transparent pb-0.5 text-xs font-semibold text-slate-300 no-underline transition-colors duration-200 hover:text-cyan-200",
    mobileLinkActive:
      "border-b-2 border-cyan-300 pb-0.5 text-xs font-semibold text-white no-underline",
    launch:
      "rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl no-underline",
  },
  c: {
    header: "sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-md",
    logo: "font-headline text-xl font-extrabold tracking-tight text-slate-900 no-underline transition-transform duration-200 hover:scale-[1.02]",
    linkIdle:
      "border-b-2 border-transparent pb-0.5 text-sm font-semibold text-slate-600 no-underline transition-colors duration-200 hover:text-slate-900",
    linkActive:
      "border-b-2 border-slate-900 pb-0.5 text-sm font-semibold text-slate-900 no-underline",
    mobileBar: "flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 px-6 py-2 md:hidden",
    mobileLinkIdle:
      "border-b-2 border-transparent pb-0.5 text-xs font-semibold text-slate-600 no-underline transition-colors duration-200 hover:text-slate-900",
    mobileLinkActive:
      "border-b-2 border-slate-900 pb-0.5 text-xs font-semibold text-slate-900 no-underline",
    launch:
      "rounded-full border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md no-underline",
  },
  d: {
    header:
      "sticky top-0 z-50 border-b border-slate-200/60 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md",
    logo: "font-headline text-xl font-extrabold tracking-tight text-helix-primary no-underline transition-transform duration-200 hover:scale-[1.02]",
    linkIdle:
      "border-b-2 border-transparent pb-0.5 text-sm font-semibold text-slate-600 no-underline transition-colors duration-200 hover:text-helix-primary",
    linkActive:
      "border-b-2 border-helix-primary pb-0.5 text-sm font-semibold text-helix-primary no-underline",
    mobileBar: "flex flex-wrap items-center justify-center gap-4 border-t border-slate-100 px-6 py-2 md:hidden",
    mobileLinkIdle:
      "border-b-2 border-transparent pb-0.5 text-xs font-semibold text-slate-600 no-underline transition-colors duration-200 hover:text-helix-primary",
    mobileLinkActive:
      "border-b-2 border-helix-primary pb-0.5 text-xs font-semibold text-helix-primary no-underline",
    launch:
      "rounded-full bg-helix-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:scale-[1.02] hover:bg-helix-primary-dim hover:shadow-lg no-underline",
  },
};

export function LandingVariantNavbar({
  preset,
  homePath,
}: {
  preset: LandingVariantNavPreset;
  /** Base path for this preview, e.g. `/landing-variants/a`, used for in-page anchors. */
  homePath: string;
}) {
  const pathname = usePathname();
  const p = presets[preset];

  const onVariantPage = pathname.startsWith("/landing-variants");
  const productsHref = onVariantPage ? `${homePath}#products` : pathname === "/" ? "#products" : "/#products";
  const contactHref = onVariantPage ? `${homePath}#contact` : pathname === "/" ? "#contact" : "/#contact";

  const homeActive = pathname === homePath;

  const pulseHref = pulseApp.login();

  return (
    <header className={p.header}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className={p.logo}>
          Helix Systems
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-10 md:flex">
          <Link href={homePath} className={homeActive ? p.linkActive : p.linkIdle}>
            Home
          </Link>
          <a href={productsHref} className={p.linkIdle}>
            Products
          </a>
          <a href={contactHref} className={p.linkIdle}>
            Contact
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link href={pulseHref} className={`hidden md:inline-flex ${p.launch}`}>
            Launch Pulse
          </Link>
        </div>
      </nav>

      <div className={p.mobileBar}>
        <Link href={homePath} className={homeActive ? p.mobileLinkActive : p.mobileLinkIdle}>
          Home
        </Link>
        <a href={productsHref} className={p.mobileLinkIdle}>
          Products
        </a>
        <a href={contactHref} className={p.mobileLinkIdle}>
          Contact
        </a>
        <Link href={pulseHref} className={`${p.launch} text-xs`}>
          Launch Pulse
        </Link>
      </div>
    </header>
  );
}
