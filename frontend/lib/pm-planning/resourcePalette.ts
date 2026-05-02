/** Stable bar colors per resource label (Tailwind `bg-*`). */
export function resourceBarClass(resource: string | undefined): string {
  const r = (resource ?? "Other").toLowerCase();
  if (r.includes("pm")) return "bg-blue-500";
  if (r.includes("procurement")) return "bg-violet-500";
  if (r.includes("site")) return "bg-orange-500";
  if (r.includes("plumb")) return "bg-teal-500";
  if (r.includes("chemical")) return "bg-pink-500";
  if (r.includes("mechanical")) return "bg-yellow-500";
  if (r.includes("inspect")) return "bg-indigo-600";
  if (r.includes("tile")) return "bg-emerald-500";
  if (r.includes("plaster")) return "bg-fuchsia-500";
  if (r.includes("structural")) return "bg-purple-700";
  if (r.includes("electrical")) return "bg-amber-300";
  return "bg-slate-400";
}
