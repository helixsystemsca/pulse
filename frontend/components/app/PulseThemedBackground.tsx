/**
 * App canvas behind cards: premium neutral spotlight gradient (consistent across pages).
 */
export function PulseThemedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-ds-bg" />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            "radial-gradient(1200px 700px at 18% 12%, rgba(255,255,255,0.92), rgba(255,255,255,0.35) 55%, transparent 72%)," +
            "radial-gradient(900px 520px at 85% 10%, rgba(76,84,84,0.08), transparent 60%)," +
            "radial-gradient(1000px 650px at 70% 92%, rgba(30,168,150,0.10), transparent 62%)," +
            "linear-gradient(180deg, rgba(250,251,252,1) 0%, rgba(244,246,248,1) 55%, rgba(239,242,245,1) 100%)",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(1200px 700px at 18% 12%, rgba(255,255,255,0.10), transparent 60%)," +
            "radial-gradient(900px 560px at 85% 10%, rgba(43,196,176,0.14), transparent 62%)," +
            "radial-gradient(1100px 700px at 70% 95%, rgba(227,182,85,0.10), transparent 60%)," +
            "linear-gradient(180deg, rgba(11,15,20,1) 0%, rgba(12,16,21,1) 55%, rgba(9,12,16,1) 100%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ color: "color-mix(in srgb, var(--ds-success) 14%, transparent)" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path vectorEffect="nonScalingStroke" strokeWidth={0.52} opacity={0.35} d="M -8 12 C 12 4, 22 22, 42 14 S 72 8, 108 18" />
          <path vectorEffect="nonScalingStroke" strokeWidth={1.18} opacity={0.28} d="M -6 28 C 8 38, 28 20, 48 30 S 78 24, 106 34" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.68} opacity={0.32} d="M -10 48 C 14 40, 34 56, 52 44 S 88 52, 110 42" />
          <path vectorEffect="nonScalingStroke" strokeWidth={1.05} opacity={0.24} d="M -4 62 C 18 72, 38 52, 58 64 S 92 58, 108 68" />
        </g>
      </svg>
    </div>
  );
}
