import Image from "next/image";

type Variant = "header" | "footer" | "compact";

/**
 * Frame height drives display size; the image uses h-full w-auto so `object-contain`
 * scales from height first (avoids wide/letterboxed PNGs shrinking to a tiny mark when
 * max-width also caps the box).
 *
 * Sizes roughly match previous text marks:
 * - header: was `text-xl font-extrabold` (~1.25rem / ~1.75rem line) — use ~36px frame
 * - footer (marketing): was `text-lg font-bold`
 * - compact (app dashboard footer): was `text-xs` powered-by line
 */
const frameClass: Record<Variant, string> = {
  /** ~`text-xl`/`text-2xl` bold line box; width follows aspect ratio (no max-w shrink) */
  header: "inline-flex h-9 items-center sm:h-10",
  /** ~`text-lg font-bold` footer brand */
  footer: "inline-flex h-8 items-center sm:h-9",
  /** ~`text-xs` powered-by strip */
  compact: "inline-flex h-4 items-center",
};

const sizesAttr: Record<Variant, string> = {
  header: "(max-width: 640px) 90vw, 280px",
  footer: "(max-width: 768px) 75vw, 220px",
  compact: "180px",
};

/**
 * Wordmark from `public/images/helix.png`.
 * For sharpest results on retina, use a PNG with at least ~2× the frame’s CSS pixels
 * of non-transparent pixels, or replace with SVG.
 */
export function HelixMarketingLogo({
  variant = "header",
  className = "",
  priority = false,
}: {
  variant?: Variant;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={`${frameClass[variant]} ${className}`.trim()}>
      <Image
        src="/images/helix.png"
        alt="Helix Systems"
        width={1920}
        height={640}
        priority={priority}
        sizes={sizesAttr[variant]}
        className="h-full w-auto max-w-none object-contain object-left"
      />
    </span>
  );
}
