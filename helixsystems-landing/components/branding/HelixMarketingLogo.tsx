import Image from "next/image";

type Variant = "header" | "footer" | "compact";

/**
 * Frame height drives display size; the image uses h-full w-auto so `object-contain`
 * scales from height first (avoids wide/letterboxed PNGs shrinking to a tiny mark when
 * max-width also caps the box).
 *
 * Display height = wrapper frame; marketing header + site footer use 64px; compact stays smaller.
 */
const frameClass: Record<Variant, string> = {
  /** 64px (`h-16`); image uses `h-full` so rendered height matches */
  header: "inline-flex h-16 items-center",
  /** Same frame as header for HelixFooter wordmark */
  footer: "inline-flex h-16 items-center",
  /** ~`text-xs` powered-by strip */
  compact: "inline-flex h-4 items-center",
};

const sizesAttr: Record<Variant, string> = {
  header: "(max-width: 640px) 85vw, 400px",
  footer: "(max-width: 768px) 85vw, 400px",
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
