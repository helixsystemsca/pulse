"use client";

import { motion } from "framer-motion";
import { ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";

export type TrainingMatrixButtonProps = {
  href: string;
  className?: string;
  /** Smaller control for peek header */
  compact?: boolean;
  /** Stretch to container width (narrow dashboard column) */
  fullWidth?: boolean;
};

export function TrainingMatrixButton({ href, className, compact = false, fullWidth = false }: TrainingMatrixButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: fullWidth ? 1 : 1.02 }}
      whileTap={{ scale: fullWidth ? 1 : 0.98 }}
      transition={{ type: "spring", stiffness: 480, damping: 28 }}
      className={cn(fullWidth && "w-full")}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold shadow-md transition-[box-shadow,background] duration-200",
          "bg-gradient-to-r from-violet-600/95 via-indigo-600/95 to-sky-600/95 text-white",
          "shadow-[0_10px_28px_-10px_rgba(79,70,229,0.55),0_4px_14px_-6px_rgba(14,165,233,0.35)]",
          "ring-1 ring-white/20 hover:shadow-[0_14px_36px_-12px_rgba(79,70,229,0.55)] hover:ring-white/30",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
          compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm",
          fullWidth && "w-full min-w-0",
          className,
        )}
      >
        <LayoutGrid className={cn("shrink-0 opacity-95", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
        <span>Open training matrix</span>
        <ChevronRight className={cn("shrink-0 opacity-90", compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
      </Link>
    </motion.div>
  );
}
