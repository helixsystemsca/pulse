import Link from "next/link";
import { mailtoSupport } from "@/lib/helix-emails";

const links = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: mailtoSupport("Support request"), label: "Support" },
  { href: "#contact", label: "Contact Us" },
] as const;

export type HelixFooterClassNames = {
  footer?: string;
  inner?: string;
  brandBlock?: string;
  brand?: string;
  tagline?: string;
  nav?: string;
  link?: string;
  pulseLink?: string;
  copyright?: string;
};

export function HelixFooter({ classNames }: { classNames?: HelixFooterClassNames }) {
  const cn = classNames ?? {};
  return (
    <footer className={`mt-0 border-t border-helix-outline/20 bg-helix-surface ${cn.footer ?? ""}`.trim()}>
      <div
        className={`mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-8 ${cn.inner ?? ""}`.trim()}
      >
        <div className={`text-center md:text-left ${cn.brandBlock ?? ""}`.trim()}>
          <Link
            href="/"
            className={`font-headline text-lg font-bold tracking-tight text-helix-onSurface no-underline ${cn.brand ?? ""}`.trim()}
          >
            Helix Systems
          </Link>
          <p className={`mt-2 text-sm font-medium tracking-wide text-helix-onSurfaceVariant ${cn.tagline ?? ""}`.trim()}>
            Industrial software &amp; field intelligence
          </p>
        </div>

        <nav className={`flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end ${cn.nav ?? ""}`.trim()}>
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`text-sm font-medium text-helix-onSurfaceVariant no-underline transition-all duration-200 ease-in-out hover:text-helix-primary ${cn.link ?? ""}`.trim()}
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/pulse"
            title="Pulse — by Helix Systems"
            className={`text-sm font-semibold text-helix-primary no-underline transition-all duration-200 ease-in-out hover:underline ${cn.pulseLink ?? ""}`.trim()}
          >
            Pulse
          </Link>
        </nav>

        <p
          className={`text-center text-sm text-helix-onSurfaceVariant/80 md:text-right md:shrink-0 ${cn.copyright ?? ""}`.trim()}
        >
          © {new Date().getFullYear()} Helix Systems. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
