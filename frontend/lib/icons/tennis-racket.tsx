/**
 * Tennis racket icon (Lucide Lab paths, ISC).
 * @see https://lucide.dev/icons/lab/tennis-racket
 */
import { forwardRef, createElement } from "react";
import type { LucideIcon } from "lucide-react";

const TENNIS_RACKET_NODE = [
  [
    "path",
    {
      d: "M10.7 4.7c3-3 7.4-3.6 9.8-1.2s1.8 6.8-1.2 9.8a9.5 9.5 0 0 1-4.3 2.5c-2.1.5-4.1.1-5.5-1.3S7.7 11.1 8.2 9a9.5 9.5 0 0 1 2.5-4.3",
      key: "zxj3xr",
    },
  ],
  ["path", { d: "M8.2 9 6 18l9-2.2", key: "1ivsmd" }],
  ["path", { d: "m2 22 4-4", key: "vwo6p4" }],
  ["circle", { cx: "20", cy: "20", r: "2", key: "a056ao" }],
] as const;

export const TennisRacket: LucideIcon = forwardRef(
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
        className: ["lucide", "lucide-tennis-racket", className].filter(Boolean).join(" "),
        ...rest,
      },
      [
        ...TENNIS_RACKET_NODE.map(([tag, attrs]) => createElement(tag, { ...attrs, key: attrs.key })),
        ...(Array.isArray(children) ? children : children ? [children] : []),
      ],
    ),
);

TennisRacket.displayName = "TennisRacket";
