/** Human-readable duration from fractional hours (inventory replenishment metrics). */
export function formatDurationHours(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1 / 60) return "<1m";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function formatYoyReplenishChange(changePct: number | null | undefined): string | null {
  if (changePct == null || Number.isNaN(changePct)) return null;
  if (changePct === 0) return "Same as prior year";
  const abs = Math.abs(changePct).toFixed(1);
  return changePct < 0 ? `${abs}% faster than prior year` : `${abs}% slower than prior year`;
}
