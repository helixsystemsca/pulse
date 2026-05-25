/**
 * Tennis ball icon (Lucide Lab paths, ISC).
 * @see https://lucide.dev/icons/lab/tennis-ball
 */
import { forwardRef, createElement } from "react";
import type { LucideIcon } from "lucide-react";

const TENNIS_BALL_NODE = [
  ["path", { d: "M2 12c5.5 0 10-4.5 10-10", key: "179xs2" }],
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M22 12c-5.5 0-10 4.5-10 10", key: "gdzvca" }],
] as const;

export const TennisBall: LucideIcon = forwardRef(
  (
    {
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className = "",
      children,
      ...rest
    },
    ref,
  ) =>
    createElement(
      "svg",
      {
        ref,
        xmlns: "http://www.w3.org/2000/svg",
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color,
        strokeWidth: absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        className: ["lucide", "lucide-tennis-ball", className].filter(Boolean).join(" "),
        ...rest,
      },
      [
        ...TENNIS_BALL_NODE.map(([tag, attrs]) => createElement(tag, { ...attrs, key: attrs.key })),
        ...(Array.isArray(children) ? children : children ? [children] : []),
      ],
    ),
);

TennisBall.displayName = "TennisBall";
