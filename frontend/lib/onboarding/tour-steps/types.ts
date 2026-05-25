export type TourPlacement = "top" | "right" | "bottom" | "left";

export type TourStep = {
  target: string;
  title: string;
  description: string;
  placement: TourPlacement;
};
