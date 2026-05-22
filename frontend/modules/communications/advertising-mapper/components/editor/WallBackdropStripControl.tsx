"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { processBackdropImageFile } from "@/modules/communications/advertising-mapper/lib/advertising-backdrop-image";
import { wallInchesFromBackdropPixels } from "@/modules/communications/advertising-mapper/lib/wall-workable-area";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";

type BackdropPatch = {
  backdropUrl?: string;
  backdropNaturalWidth?: number;
  backdropNaturalHeight?: number;
  width_inches?: number;
  height_inches?: number;
};

type Props = {
  wall: FacilityWallPlan;
  onBackdropChange: (patch: BackdropPatch) => void;
  onGenerateEmptySpace?: () => void | Promise<void>;
  generateBusy?: boolean;
  className?: string;
};

export function WallBackdropStripControl({
  wall,
  onBackdropChange,
  onGenerateEmptySpace,
  generateBusy = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(file: File | null) {
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
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Background photo — {wall.name}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            buttonVariants({ intent: "secondary", surface: "light" }),
            "inline-flex h-7 cursor-pointer items-center gap-1.5 px-2.5 text-[11px]",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {busy ? "Uploading…" : wall.backdropUrl ? "Replace photo" : "Upload photo"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onPick(f);
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
              "inline-flex h-7 items-center gap-1 px-2 text-[11px] text-red-700",
            )}
            onClick={() => {
              setErr(null);
              onBackdropChange({
                backdropUrl: undefined,
                backdropNaturalWidth: undefined,
                backdropNaturalHeight: undefined,
              });
            }}
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
              "inline-flex h-7 items-center gap-1 px-2 text-[11px]",
            )}
            onClick={() => void onGenerateEmptySpace()}
          >
            {generateBusy ? "Generating…" : "Empty plot space"}
          </button>
        ) : null}
      </div>
      {err ? <p className="text-[10px] text-red-600">{err}</p> : null}
      <p className="text-[10px] leading-relaxed text-slate-500">
        One photo per view (Left, Center, Right, Scoreboard). Stored in this browser for your facility.
      </p>
    </div>
  );
}
