/**
 * Shared canvas for Pulse surfaces: matches login (gradient, grid, soft waves, radial depth).
 * Fixed under content (`-z-10`); parent should be `relative` with default stacking.
 */
export function PulseThemedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-br from-[#f1f5f9] via-[#e8edf7] to-[#dbe5f8] dark:from-[#0c1424] dark:via-[#0e1629] dark:to-[#080f18]" />
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%2330568b' stroke-width='0.85' stroke-opacity='0.11'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%234a6fa5' stroke-width='0.85' stroke-opacity='0.14'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "32px 32px",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full text-blue-600/[0.09] dark:text-sky-400/[0.1]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path vectorEffect="nonScalingStroke" strokeWidth={0.52} opacity={0.45} d="M -8 12 C 12 4, 22 22, 42 14 S 72 8, 108 18" />
          <path vectorEffect="nonScalingStroke" strokeWidth={1.18} opacity={0.38} d="M -6 28 C 8 38, 28 20, 48 30 S 78 24, 106 34" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.68} opacity={0.42} d="M -10 48 C 14 40, 34 56, 52 44 S 88 52, 110 42" />
          <path vectorEffect="nonScalingStroke" strokeWidth={1.05} opacity={0.33} d="M -4 62 C 18 72, 38 52, 58 64 S 92 58, 108 68" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.44} opacity={0.36} d="M -12 78 C 10 68, 30 88, 52 76 S 84 82, 112 74" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.92} opacity={0.4} d="M -8 92 C 16 98, 36 82, 60 94 S 96 88, 108 96" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.58} opacity={0.34} d="M 8 -4 C 18 12, 32 -2, 52 8 S 82 4, 98 14" />
          <path vectorEffect="nonScalingStroke" strokeWidth={1.12} opacity={0.3} d="M 22 100 C 38 88, 52 100, 72 92 S 98 96, 104 88" />
          <path vectorEffect="nonScalingStroke" strokeWidth={0.78} opacity={0.32} d="M -14 36 C 24 52, 44 28, 72 40 S 98 32, 114 48" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_0%_0%,rgba(37,99,235,0.18),transparent_55%)] dark:bg-[radial-gradient(ellipse_85%_65%_at_0%_0%,rgba(59,130,246,0.22),transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_100%_100%,rgba(79,70,229,0.15),transparent_48%)] dark:bg-[radial-gradient(ellipse_75%_60%_at_100%_100%,rgba(99,102,241,0.18),transparent_48%)]" />
    </div>
  );
}
