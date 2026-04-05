import Image from "next/image";

type Variant = "header" | "footer" | "compact";

/** Footer wordmark: 5× previous `h-7` (~140px tall) so it reads at marketing footer scale */
const heightClass: Record<Variant, string> = {
  header: "h-9",
  footer: "h-[8.75rem] max-w-full",
  compact: "h-5",
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
      width={480}
      height={160}
      priority={priority}
      className={`w-auto object-contain object-left ${variant === "footer" ? "" : "max-w-[min(100%,15rem)]"} ${heightClass[variant]} ${className}`.trim()}
    />
  );
}
