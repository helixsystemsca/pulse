"use client";

import { X } from "lucide-react";
import type { StandardAdSizePresetId } from "@/modules/communications/advertising-mapper/lib/standard-ad-sizes";
import { AD_SIZE_PRESETS } from "@/modules/communications/advertising-mapper/lib/standard-ad-sizes";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  busy?: boolean;
  onConfirm: (preset: StandardAdSizePresetId) => void;
  onCancel: () => void;
};

export function SnipPresetBar({ busy, onConfirm, onCancel }: Props) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex max-w-[min(100%,28rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">Snip to standard card</p>
          <p className="text-[10px] text-slate-500">Choose a size for the ad cropped from the photo.</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={onCancel}
          aria-label="Cancel snip"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["4x4", "4x8"] as const).map((id) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            className={cn(
              buttonVariants({ intent: "primary", surface: "light" }),
              "flex-1 text-xs",
              busy && "opacity-60",
            )}
            onClick={() => onConfirm(id)}
          >
            {AD_SIZE_PRESETS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
