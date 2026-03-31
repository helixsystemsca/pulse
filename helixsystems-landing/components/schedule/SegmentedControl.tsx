"use client";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-[10px] border border-slate-200/80 bg-slate-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-slate-200/90"
                : "text-pulse-muted hover:bg-white/70 hover:text-pulse-navy"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
