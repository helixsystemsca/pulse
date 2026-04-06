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
    <div className="flex rounded-[10px] border border-gray-200 bg-gray-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-[#1F2937] dark:bg-[#0F172A]/90 dark:shadow-none">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? "bg-white text-[#2B4C7E] shadow-sm ring-1 ring-gray-200/90 dark:bg-[#111827] dark:text-blue-300 dark:ring-[#1F2937]"
                : "text-gray-500 hover:bg-white/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
