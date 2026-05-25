import type { TourStep } from "@/lib/onboarding/tour-steps/types";

/** Union bounding rect for one or more tour target nodes (e.g. CO₂ + pool widgets). */
export function getTourTargetElements(selector: string): Element[] {
  const all = Array.from(document.querySelectorAll(selector));
  if (selector === '[data-tour="feature-workspace"]' && all.length > 1) {
    // Page-level workspace wins over the app-shell wrapper in AppMainChromeColumn.
    return [all[all.length - 1]!];
  }
  return all;
}

export function hasTourTarget(selector: string): boolean {
  return getTourTargetElements(selector).length > 0;
}

export function getTourTargetUnionRect(elements: Element[]): DOMRect | null {
  if (elements.length === 0) return null;

  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const el of elements) {
    const r = el.getBoundingClientRect();
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }

  if (!Number.isFinite(top)) return null;

  return new DOMRect(left, top, right - left, bottom - top);
}

export function stepHasTourTarget(step: TourStep): boolean {
  if (step.rotateTargets?.length) {
    return step.rotateTargets.some((selector) => hasTourTarget(selector));
  }
  return hasTourTarget(step.target);
}
