"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import { processBackdropImageFile } from "@/modules/communications/advertising-mapper/lib/advertising-backdrop-image";
import { wallInchesFromBackdropPixels } from "@/modules/communications/advertising-mapper/lib/wall-workable-area";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

type Props = {
  wall: FacilityWallPlan;
  onBackdropChange: (patch: {
    backdropUrl?: string;
    backdropNaturalWidth?: number;
    backdropNaturalHeight?: number;
    width_inches?: number;
    height_inches?: number;
  }) => void;
  /** Tighter layout for the right rail. */
  compact?: boolean;
  onGenerateEmptySpace?: () => void | Promise<void>;
  generateBusy?: boolean;
};

export function WallBackdropUpload({
  wall,
  onBackdropChange,
  compact = false,
  onGenerateEmptySpace,
  generateBusy = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const patch = await processBackdropImageFile(file);
      const inches = wallInchesFromBackdropPixels(patch.backdropNaturalWidth, patch.backdropNaturalHeight);
      onBackdropChange({ ...patch, ...inches });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-slate-50/80", compact ? "p-2" : "p-3")}>
      <p className={cn("font-semibold text-slate-800", compact ? "text-[10px]" : "text-xs")}>
        Background — {wall.name}
      </p>
      {!compact ? (
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Upload a reference photo for this arena face. Snip existing ads onto standard cards, then extend with empty plot
          space.
        </p>
      ) : null}
      {err ? <p className="mt-2 text-[11px] font-medium text-red-600">{err}</p> : null}
      {wall.backdropUrl ? (
        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wall.backdropUrl} alt="" className="max-h-28 w-full object-cover" />
        </div>
      ) : null}
      <div className={cn("flex flex-wrap gap-2", compact ? "mt-1.5" : "mt-2")}>
        <label
          className={cn(
            buttonVariants({ intent: "secondary", surface: "light" }),
            "inline-flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {busy ? "Uploading…" : wall.backdropUrl ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onFileChange(f);
              e.target.value = "";
            }}
          />
        </label>
        {wall.backdropUrl ? (
          <button
            type="button"
            disabled={busy}
            className={cn(
              buttonVariants({ intent: "secondary", surface: "light" }),
              "inline-flex h-8 items-center gap-1.5 px-3 text-xs text-red-700",
            )}
            onClick={() =>
              onBackdropChange({
                backdropUrl: undefined,
                backdropNaturalWidth: undefined,
                backdropNaturalHeight: undefined,
              })
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
        {onGenerateEmptySpace ? (
          <button
            type="button"
            disabled={busy || generateBusy}
            className={cn(
              buttonVariants({ intent: "secondary", surface: "light" }),
              "inline-flex h-8 items-center gap-1.5 px-3 text-xs",
            )}
            onClick={() => void onGenerateEmptySpace()}
          >
            {generateBusy ? "Generating…" : "Add empty plot space"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
