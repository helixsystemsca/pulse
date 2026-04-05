import Image from "next/image";

type Variant = "header" | "footer" | "compact";

/** Per-variant sizing: header is 4× previous `h-9` (~144px); footer remains large wordmark */
const variantClass: Record<Variant, string> = {
  header: "h-36 w-auto max-w-[min(100%,48rem)] object-contain object-left",
  footer: "h-[8.75rem] w-auto max-w-full object-contain object-left",
  compact: "h-5 w-auto max-w-[min(100%,15rem)] object-contain object-left",
};

/**
 * Wordmark from `public/images/helix.png`. Add that file under `public/images/`.
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
    <Image
      src="/images/helix.png"
      alt="Helix Systems"
      width={960}
      height={320}
      priority={priority}
      className={`${variantClass[variant]} ${className}`.trim()}
    />
  );
}
