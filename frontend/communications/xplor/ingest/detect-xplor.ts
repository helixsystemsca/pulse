/** True when text likely contains Xplor paragraph styles. */
export function looksLikeXplorTaggedText(text: string): boolean {
  return /pstyle:\s*Event/i.test(text);
}
