type CacheEntry<T = unknown> = {
  data: T;
  timestamp: number;
};

type CacheDomain = "accounts" | "categories" | "transactions";

const CACHE_TTL_MS: Record<CacheDomain, number> = {
  categories: 24 * 60 * 60 * 1000,   // 24 hours
  accounts: 15 * 60 * 1000,           // 15 minutes
  transactions: 15 * 60 * 1000,       // 15 minutes
};

const STORAGE_PREFIX = "lf_cache_";
const DISABLED_KEY = "lf_cache_disabled";
const USER_ID_KEY = "lf_cache_user_id";

function domainPrefix(domain: CacheDomain): string {
  return `${STORAGE_PREFIX}${domain}:`;
}

function buildKey(domain: CacheDomain, signature: string): string {
  return `${domainPrefix(domain)}${signature}`;
}

function isExpired(timestamp: number, domain: CacheDomain): boolean {
  return Date.now() - timestamp > CACHE_TTL_MS[domain];
}

function isStorageAvailable(): boolean {
  try {
    const key = "__lf_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function isCacheDisabled(): boolean {
  if (!isStorageAvailable()) return false;
  return localStorage.getItem(DISABLED_KEY) === "1";
}

export function setCacheDisabled(disabled: boolean): void {
  if (!isStorageAvailable()) return;
  if (disabled) {
    localStorage.setItem(DISABLED_KEY, "1");
    clearAllCache();
  } else {
    localStorage.removeItem(DISABLED_KEY);
  }
}

export function getCached<T>(domain: CacheDomain, signature: string): T | null {
  if (!isStorageAvailable() || isCacheDisabled()) return null;
  try {
    const raw = localStorage.getItem(buildKey(domain, signature));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (isExpired(entry.timestamp, domain)) {
      localStorage.removeItem(buildKey(domain, signature));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(domain: CacheDomain, signature: string, data: T): void {
  if (!isStorageAvailable() || isCacheDisabled()) return;
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  const serialized = JSON.stringify(entry);
  try {
    localStorage.setItem(buildKey(domain, signature), serialized);
  } catch {
    evictOldest(serialized.length);
    try {
      localStorage.setItem(buildKey(domain, signature), serialized);
    } catch {
      // still full — give up
    }
  }
}

function evictOldest(neededBytes: number): void {
  const entries: { key: string; timestamp: number; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key)!;
      const parsed: CacheEntry = JSON.parse(raw);
      entries.push({ key, timestamp: parsed.timestamp, size: raw.length * 2 });
    } catch { /* skip corrupt */ }
  }
  entries.sort((a, b) => a.timestamp - b.timestamp);
  let freed = 0;
  for (const entry of entries) {
    if (freed >= neededBytes) break;
    localStorage.removeItem(entry.key);
    freed += entry.size;
  }
}

export function purgeExpiredEntries(): void {
  if (!isStorageAvailable()) return;
  const domains: CacheDomain[] = ["accounts", "categories", "transactions"];
  for (const domain of domains) {
    const prefix = domainPrefix(domain);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const entry: CacheEntry = JSON.parse(raw);
        if (isExpired(entry.timestamp, domain)) keysToRemove.push(key);
      } catch {
        keysToRemove.push(key!);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

export function clearDomainCache(domain: CacheDomain): void {
  if (!isStorageAvailable()) return;
  const prefix = domainPrefix(domain);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function clearAllCache(): void {
  clearDomainCache("accounts");
  clearDomainCache("categories");
  clearDomainCache("transactions");
}

export function handleUserChange(userId: string | null): void {
  if (!isStorageAvailable()) return;

  if (!userId) {
    localStorage.removeItem(USER_ID_KEY);
    clearAllCache();
    return;
  }

  const previousUserId = localStorage.getItem(USER_ID_KEY);
  if (previousUserId && previousUserId !== userId) {
    clearAllCache();
  }
  localStorage.setItem(USER_ID_KEY, userId);
}

export function requestSignature(endpoint: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return endpoint;
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return `${endpoint}?${sorted}`;
}

// ---------------------------------------------------------------------------
// Request deduplication
// ---------------------------------------------------------------------------

const DEDUP_TIMEOUT_MS = 30_000;
const inflight = new Map<string, Promise<unknown>>();

export function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => reject(new Error("Request timeout")), DEDUP_TIMEOUT_MS);
    // Prevent the timer from keeping Node.js alive in SSR/tests
    if (typeof id === "object" && "unref" in id) id.unref();
  });
  const promise = Promise.race([fetcher(), timeout]).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Cross-endpoint cache reuse (collection → single / subset)
// ---------------------------------------------------------------------------

type PaginatedShape<T> = {
  data: { data: T[]; pagination: unknown } | null;
  status: number;
  error: string | null;
};

function isCollectionKey(key: string, prefix: string): boolean {
  const signature = key.slice(prefix.length);
  // Collection keys are list endpoints (no path ID segment after the base)
  // e.g. "/api/accounts" or "/api/accounts?limit=100" but NOT "/api/accounts/abc-123"
  const path = signature.split("?")[0];
  const segments = path.split("/").filter(Boolean);
  // List endpoints: ["api", "accounts"] (2 segments)
  // Detail endpoints: ["api", "accounts", "abc-123"] (3+ segments)
  return segments.length <= 2;
}

export function findInCachedCollections<T extends { id: string }>(
  domain: CacheDomain,
  id: string,
): T | null {
  if (!isStorageAvailable() || isCacheDisabled()) return null;

  const prefix = domainPrefix(domain);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    if (!isCollectionKey(key, prefix)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry = JSON.parse(raw);
      if (isExpired(entry.timestamp, domain)) continue;

      const payload = entry.data as PaginatedShape<T>;
      const items = payload?.data?.data;
      if (!Array.isArray(items)) continue;

      const match = items.find((item) => item.id === id);
      if (match) return match;
    } catch {
      continue;
    }
  }
  return null;
}

export function findManyInCachedCollections<T extends { id: string }>(
  domain: CacheDomain,
  ids: string[],
): T[] | null {
  if (!isStorageAvailable() || isCacheDisabled()) return null;
  if (ids.length === 0) return [];

  const pool = new Map<string, T>();
  const prefix = domainPrefix(domain);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    if (!isCollectionKey(key, prefix)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry = JSON.parse(raw);
      if (isExpired(entry.timestamp, domain)) continue;

      const payload = entry.data as PaginatedShape<T>;
      const items = payload?.data?.data;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        if (item.id) pool.set(item.id, item);
      }
    } catch {
      continue;
    }
  }

  const results: T[] = [];
  for (const id of ids) {
    const item = pool.get(id);
    if (!item) return null;
    results.push(item);
  }
  return results;
}
