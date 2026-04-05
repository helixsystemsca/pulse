import Link from "next/link";

const variants = [
  { href: "/landing-variants/a", label: "Variant A", hint: "Minimal real estate" },
  { href: "/landing-variants/b", label: "Variant B", hint: "Corporate dark / gradient" },
  { href: "/landing-variants/c", label: "Variant C", hint: "Architectural / editorial" },
  { href: "/landing-variants/d", label: "Variant D", hint: "Premium card / bento" },
] as const;

export default function LandingVariantsHubPage() {
  return (
    <main className="min-h-screen bg-helix-bg">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-helix-primary">Design previews</p>
        <h1 className="mt-3 font-headline text-3xl font-extrabold tracking-tight text-helix-onSurface md:text-4xl">
          Landing page variants
        </h1>
        <p className="mt-4 text-lg text-helix-onSurfaceVariant">
          Same content and behavior as the home page—four distinct layout and visual styles for review.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {variants.map((v) => (
            <li key={v.href}>
              <Link
                href={v.href}
                className="flex h-full flex-col rounded-2xl border border-helix-outline/25 bg-white p-6 shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
              >
                <span className="font-headline text-lg font-bold text-helix-onSurface">{v.label}</span>
                <span className="mt-2 text-sm text-helix-onSurfaceVariant">{v.hint}</span>
                <span className="mt-4 text-sm font-semibold text-helix-primary">Open preview →</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-helix-onSurfaceVariant">
          Production home:{" "}
          <Link className="font-semibold text-helix-primary underline-offset-2 hover:underline" href="/">
            /
          </Link>
        </p>
      </div>
    </main>
  );
}
