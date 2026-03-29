"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pulseRoutes } from "@/lib/pulse-app";

const navLinkBase =
  "border-b-2 border-transparent pb-0.5 text-sm font-semibold no-underline transition-colors duration-200 hover:text-helix-primary";

const navLinkMobileBase =
  "border-b-2 border-transparent pb-0.5 text-xs font-semibold no-underline transition-colors duration-200 hover:text-helix-primary";

const launchPulseClass =
  "rounded-full bg-helix-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors duration-200 hover:bg-helix-primary-dim no-underline";

export function HelixNavbar() {
  const pathname = usePathname();
  const productsHref = pathname === "/" ? "#products" : "/#products";
  const contactHref = pathname === "/" ? "#contact" : "/#contact";
  const pulseHref = pulseRoutes.login;

  const homeActive = pathname === "/";
  const homeClass = `${navLinkBase} ${
    homeActive
      ? "border-helix-primary text-helix-primary"
      : "border-transparent text-helix-onSurfaceVariant hover:border-helix-primary"
  }`;

  return (
    <header className="sticky top-0 z-50 border-b border-helix-outline/20 bg-white/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="font-headline text-xl font-extrabold tracking-tight text-helix-primary no-underline transition-colors duration-200 hover:text-helix-primary-dim"
        >
          Helix Systems
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-10 md:flex">
          <Link href="/" className={homeClass}>
            Home
          </Link>
          <a
            href={productsHref}
            className={`${navLinkBase} border-transparent text-helix-onSurfaceVariant hover:border-helix-primary`}
          >
            Products
          </a>
          <a
            href={contactHref}
            className={`${navLinkBase} border-transparent text-helix-onSurfaceVariant hover:border-helix-primary`}
          >
            Contact
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={pulseHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`hidden md:inline-flex ${launchPulseClass}`}
          >
            Launch Pulse
          </Link>
        </div>
      </nav>

      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-helix-outline/15 px-6 py-2 md:hidden">
        <Link
          href="/"
          className={
            homeActive
              ? `${navLinkMobileBase} border-helix-primary text-helix-primary`
              : `${navLinkMobileBase} border-transparent text-helix-onSurfaceVariant hover:border-helix-primary`
          }
        >
          Home
        </Link>
        <a
          href={productsHref}
          className={`${navLinkMobileBase} border-transparent text-helix-onSurfaceVariant hover:border-helix-primary`}
        >
          Products
        </a>
        <a
          href={contactHref}
          className={`${navLinkMobileBase} border-transparent text-helix-onSurfaceVariant hover:border-helix-primary`}
        >
          Contact
        </a>
        <Link
          href={pulseHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${launchPulseClass} text-xs`}
        >
          Launch Pulse
        </Link>
      </div>
    </header>
  );
}
