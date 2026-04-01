/** ECG-style waveform — proportions tuned to read clearly beside the wordmark. */
const WAVEFORM_PATH =
  "M 7 22 H 19 L 25 22 L 33.5 7 L 41.5 33 L 49.5 13 L 57 22 H 79";

export type PulseLogoVariant = "light" | "dark";

type PulseLogoProps = {
  variant: PulseLogoVariant;
  className?: string;
};

export function PulseLogo({ variant, className = "" }: PulseLogoProps) {
  const textClass = variant === "light" ? "text-pulse-navy" : "text-white";
  const dividerClass = variant === "light" ? "bg-slate-300" : "bg-slate-400/70";

  return (
    <span
      className={`inline-flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight sm:text-xl ${textClass} ${className}`.trim()}
    >
      <svg
        className="h-7 w-[4.85rem] shrink-0 sm:h-8 sm:w-[5.35rem]"
        viewBox="0 0 86 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d={WAVEFORM_PATH}
          stroke="#2563eb"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`h-7 w-px shrink-0 rounded-full ${dividerClass}`} aria-hidden />
      <span className="tracking-[0.04em]">PULSE</span>
    </span>
  );
}
