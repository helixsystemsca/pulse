import Link from "next/link";

const links = [
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Terms of Service" },
  { href: "#", label: "Support" },
  { href: "#contact", label: "Contact Us" },
] as const;

export function HelixFooter() {
  return (
    <footer className="mt-0 border-t border-helix-outline/20 bg-helix-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="text-center md:text-left">
          <Link href="/" className="font-headline text-lg font-bold tracking-tight text-helix-onSurface no-underline">
            Helix Systems
          </Link>
          <p className="mt-2 text-sm font-medium tracking-wide text-helix-onSurfaceVariant">
            Industrial software &amp; field intelligence
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-helix-onSurfaceVariant no-underline transition-all duration-200 ease-in-out hover:text-helix-primary"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/pulse"
            title="Pulse — by Helix Systems"
            className="text-sm font-semibold text-helix-primary no-underline transition-all duration-200 ease-in-out hover:underline"
          >
            Pulse
          </Link>
        </nav>

        <p className="text-center text-sm text-helix-onSurfaceVariant/80 md:text-right md:shrink-0">
          © {new Date().getFullYear()} Helix Systems. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
