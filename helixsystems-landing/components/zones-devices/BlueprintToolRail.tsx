"use client";

import { motion } from "framer-motion";
import { DoorClosed, LayoutGrid, MousePointer2, PencilLine, Radio, Shapes } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { bpTransition } from "@/lib/motion-presets";
import type { BlueprintDesignerTool } from "./blueprint-types";

type RailItem =
  | { kind: "tool"; tool: BlueprintDesignerTool; label: string; Icon: LucideIcon }
  | { kind: "symbols"; label: string; Icon: LucideIcon };

const RAIL_ITEMS: RailItem[] = [
  { kind: "tool", tool: "select", label: "Select", Icon: MousePointer2 },
  { kind: "tool", tool: "draw-room", label: "Draw room", Icon: LayoutGrid },
  { kind: "tool", tool: "place-door", label: "Door", Icon: DoorClosed },
  { kind: "tool", tool: "place-device", label: "Place device", Icon: Radio },
  { kind: "tool", tool: "free-draw", label: "Free draw", Icon: PencilLine },
  { kind: "symbols", label: "Symbols", Icon: Shapes },
];

export function BlueprintToolRail({
  tool,
  onToolChange,
  symbolPanelOpen,
  onToggleSymbolPanel,
  disabled,
  layout = "vertical",
}: {
  tool: BlueprintDesignerTool;
  onToolChange: (t: BlueprintDesignerTool) => void;
  symbolPanelOpen: boolean;
  onToggleSymbolPanel: () => void;
  disabled?: boolean;
  /** Horizontal strip for floating canvas toolbar. */
  layout?: "vertical" | "horizontal";
}) {
  return (
    <motion.nav
      className={`bp-tool-rail bp-tool-rail--${layout}${disabled ? " bp-tool-rail--disabled" : ""}`}
      aria-label="Blueprint tools"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={bpTransition.med}
    >
      <div className="bp-tool-rail__inner">
        {RAIL_ITEMS.map((item) => {
          if (item.kind === "symbols") {
            const active = symbolPanelOpen || tool === "place-symbol";
            return (
              <motion.button
                key="symbols"
                type="button"
                className={`bp-tool-rail__btn${active ? " is-active" : ""}`}
                title={item.label}
                aria-label={item.label}
                aria-expanded={symbolPanelOpen}
                disabled={disabled}
                onClick={() => onToggleSymbolPanel()}
                whileHover={disabled ? undefined : { scale: 1.04 }}
                whileTap={disabled ? undefined : { scale: 0.96 }}
                transition={bpTransition.fast}
              >
                <item.Icon className="bp-tool-rail__icon" strokeWidth={1.75} size={22} aria-hidden />
              </motion.button>
            );
          }
          const active = tool === item.tool;
          return (
            <motion.button
              key={item.tool}
              type="button"
              className={`bp-tool-rail__btn${active ? " is-active" : ""}`}
              title={item.label}
              aria-label={item.label}
              disabled={disabled}
              onClick={() => onToolChange(item.tool)}
              whileHover={disabled ? undefined : { scale: 1.04 }}
              whileTap={disabled ? undefined : { scale: 0.96 }}
              transition={bpTransition.fast}
            >
              <item.Icon className="bp-tool-rail__icon" strokeWidth={1.75} size={22} aria-hidden />
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
