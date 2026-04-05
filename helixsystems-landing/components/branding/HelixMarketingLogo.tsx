import Image from "next/image";

type Variant = "header" | "footer" | "compact";

const heightClass: Record<Variant, string> = {
  header: "h-9",
  footer: "h-7",
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
      className={`w-auto max-w-[min(100%,15rem)] object-contain object-left ${heightClass[variant]} ${className}`.trim()}
    />
  );
}
