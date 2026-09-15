export type TourPlacement = "top" | "right" | "bottom" | "left" | "center";

export type TourStep = {
  target: string;
  /**
   * Optional selector used ONLY for positioning the modal card.
   * Spotlight + auto-advance still use {@link target} unless {@link rotateTargets} is set.
   */
  cardTarget?: string;
  /**
   * Click this control once before measuring the spotlight (e.g. switch a tab so
   * {@link target} is in the DOM). Ignored if the node is missing. Do not point this
   * at `<a>` / `<Link>` navigations — that remounts the tour.
   */
  prepareClick?: string;
  /** When set, spotlight cycles through each selector while the card stays put. */
  rotateTargets?: readonly string[];
  /** Ms between spotlight targets when {@link rotateTargets} is set (default 2400). */
  rotateIntervalMs?: number;
  title: string;
  description: string;
  placement: TourPlacement;
};
