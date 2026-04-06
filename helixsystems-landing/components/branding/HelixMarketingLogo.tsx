import Image from "next/image";

type Variant = "header" | "compact";

/**
 * Frame height drives display size. The wrapper is `block` (not `inline-flex items-center`)
 * so the `<img>` is not a flex item with `align-self: center` / intrinsic min-size quirks;
 * `h-full w-auto` + `object-contain` then reliably fills the frame height (letterboxing only
 * inside the bitmap).
 *
 * Display height = wrapper frame; marketing header uses ~44px; compact is for app “Powered by” strips.
 */
const frameClass: Record<Variant, string> = {
  /** ~44px; block wrapper so `%` height on the image resolves to full frame */
  header: "block h-11 w-max min-h-0 shrink-0",
  /** ~`text-xs` powered-by strip */
  compact: "block h-4 w-max min-h-0 shrink-0",
};

const sizesAttr: Record<Variant, string> = {
  header: "(max-width: 640px) 85vw, 400px",
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
        src="/images/helix_cropped_tight.png"
        alt="Helix Systems"
        width={1920}
        height={640}
        priority={priority}
        sizes={sizesAttr[variant]}
        className="h-full w-auto object-contain object-center"
        style={{ height: "100%", width: "auto" }}
      />
    </span>
  );
}
