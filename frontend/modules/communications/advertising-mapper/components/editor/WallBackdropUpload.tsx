"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import type { FacilityWallPlan } from "@/modules/communications/advertising-mapper/types";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

type Props = {
  wall: FacilityWallPlan;
  onBackdropChange: (patch: {
    backdropUrl?: string;
    backdropNaturalWidth?: number;
    backdropNaturalHeight?: number;
  }) => void;
};

export function WallBackdropUpload({ wall, onBackdropChange }: Props) {
  function onFileChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      const img = new window.Image();
      img.onload = () => {
        onBackdropChange({
          backdropUrl: dataUrl,
          backdropNaturalWidth: img.naturalWidth,
          backdropNaturalHeight: img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold text-slate-800">Arena backdrop — {wall.name}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Upload a photo of this wall or scoreboard face. It appears behind inventory on the canvas (session storage until
        API persistence).
      </p>
      {wall.backdropUrl ? (
        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wall.backdropUrl} alt="" className="max-h-28 w-full object-cover" />
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <label
          className={cn(
            buttonVariants({ intent: "secondary", surface: "light" }),
            "inline-flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs",
          )}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {wall.backdropUrl ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              onFileChange(f);
              e.target.value = "";
            }}
          />
        </label>
        {wall.backdropUrl ? (
          <button
            type="button"
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
      </div>
    </div>
  );
}
