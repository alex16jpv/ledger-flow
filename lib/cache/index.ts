type CacheEntry<T = unknown> = {
  data: T;
  timestamp: number;
};

type CacheDomain = "accounts" | "categories" | "transactions";

/** Per-domain TTL in milliseconds */
const DOMAIN_TTL: Record<CacheDomain, number> = {
  accounts: 7 * 24 * 60 * 60 * 1000, // 7 days — balances change with transactions
  transactions: 3 * 24 * 60 * 60 * 1000, // 3 days — most volatile data
  categories: 14 * 24 * 60 * 60 * 1000, // 14 days — rarely change
};

/** Domains that must also be invalidated when a given domain is mutated */
const INVALIDATION_MAP: Record<CacheDomain, CacheDomain[]> = {
  transactions: ["accounts"], // transactions affect account balances
  accounts: [],
  categories: [],
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
  return Date.now() - timestamp > DOMAIN_TTL[domain];
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

export function setCache<T>(
  domain: CacheDomain,
  signature: string,
  data: T,
): void {
  if (!isStorageAvailable() || isCacheDisabled()) return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(buildKey(domain, signature), JSON.stringify(entry));
  } catch {
    // storage full — silently ignore
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

/**
 * Clears the given domain cache AND any related domains
 * that depend on it (e.g. accounts when transactions change).
 */
export function invalidateDomain(domain: CacheDomain): void {
  const affected: CacheDomain[] = [domain, ...INVALIDATION_MAP[domain]];
  for (const d of affected) {
    clearDomainCache(d);
  }
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

export function requestSignature(
  endpoint: string,
  params?: Record<string, string>,
): string {
  if (!params || Object.keys(params).length === 0) return endpoint;
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${endpoint}?${sorted}`;
}
