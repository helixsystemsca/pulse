/**
 * Coalesce identical in-flight API requests (prevents duplicate roster fetches during React strict-mode / effect storms).
 */
const inflight = new Map<string, Promise<unknown>>();

export function dedupeInflightRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
