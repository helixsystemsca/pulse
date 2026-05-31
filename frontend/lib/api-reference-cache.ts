/**
 * Short-lived client cache for stable reference data (workers, zones, etc.).
 * Coalesces in-flight requests and avoids duplicate widget fetches.
 */
import { dedupeInflightRequest } from "@/lib/api-request-dedupe";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { at: number; data: T };

const store = new Map<string, CacheEntry<unknown>>();

export function setReferenceCache<T>(key: string, data: T): void {
  store.set(key, { at: Date.now(), data });
}

export function invalidateReferenceCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function fetchReferenceCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return Promise.resolve(hit.data as T);
  }
  return dedupeInflightRequest(`ref:${key}`, async () => {
    const data = await fetcher();
    store.set(key, { at: Date.now(), data });
    return data;
  });
}
