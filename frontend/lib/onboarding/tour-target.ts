/** Union bounding rect for one or more tour target nodes (e.g. CO₂ + pool widgets). */
export function getTourTargetElements(selector: string): Element[] {
  return Array.from(document.querySelectorAll(selector));
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
