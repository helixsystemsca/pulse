/**
 * App canvas behind cards: token-based background with optional warm grid (light) / soft depth (dark).
 */
export function PulseThemedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(165deg,
            color-mix(in srgb, var(--ds-bg) 100%, white) 0%,
            var(--ds-bg) 38%,
            color-mix(in srgb, var(--ds-bg) 88%, var(--ds-warning)) 100%)`,
        }}
      />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%23c4a574' stroke-width='0.75' stroke-opacity='0.14'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.75' stroke-opacity='0.06'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
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
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 85% 65% at 0% 0%, color-mix(in srgb, var(--ds-success) 16%, transparent), transparent 55%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 75% 60% at 100% 100%, color-mix(in srgb, var(--ds-warning) 12%, transparent), transparent 48%)`,
        }}
      />
    </div>
  );
}
