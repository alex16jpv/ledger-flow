# Cache System Review

## Architecture Overview

```
┌──────────────┐    useEffect    ┌───────────────┐    fetch()    ┌──────────────────┐   proxy()   ┌─────────────┐
│  React       │ ──────────────▸ │  Service      │ ────────────▸ │ Next.js API      │ ──────────▸ │  Backend    │
│  Components  │                 │  Layer        │               │ Routes           │             │  API        │
│  (client)    │ ◂────────────── │  (client)     │ ◂──────────── │ (server)         │ ◂────────── │             │
└──────────────┘    JSON data    └───────┬───────┘  JSON + HTTP  └────────┬─────────┘   JSON      └─────────────┘
                                         │                                │
                                         ▼                                ▼
                                ┌─────────────────┐             ┌──────────────────┐
                                │  localStorage   │             │  Cache-Control   │
                                │  Cache Layer    │             │  Headers         │
                                │  (lib/cache)    │             │  (HTTP layer)    │
                                └─────────────────┘             └──────────────────┘
```

The system uses a **two-tier caching strategy**:

1. **Client-side localStorage cache** (`lib/cache/index.ts`) — the primary caching mechanism, managed at the service layer.
2. **HTTP Cache-Control headers** — a secondary layer set on API route GET responses (`private, max-age=60, stale-while-revalidate=300`).

---

## Core Cache Module (`lib/cache/index.ts`)

### Data Model

Each cache entry is stored in `localStorage` as a JSON-serialized object:

```ts
type CacheEntry<T> = {
  data: T;        // The full ProxyResponse object (not just the payload)
  timestamp: number; // Date.now() at write time
};
```

Entries are keyed by domain + request signature:
```
lf_cache_accounts:/api/accounts
lf_cache_accounts:/api/accounts?ids=abc,def
lf_cache_transactions:/api/transactions?limit=100
lf_cache_categories:/api/categories/cat-123
```

### Domain Configuration

| Domain | TTL | Rationale |
|---|---|---|
| `categories` | 24 hours | Rarely change after initial setup |
| `accounts` | 15 minutes | Balances shift with every transaction |
| `transactions` | 15 minutes | Frequently created/updated |

Only three domains are defined: `accounts`, `categories`, `transactions`. Budgets are **not cached**.

### Key Functions

| Function | Purpose |
|---|---|
| `getCached<T>(domain, signature)` | Read-through: returns cached data if present and not expired, else `null` |
| `setCache<T>(domain, signature, data)` | Writes an entry; silently drops on storage-full |
| `clearDomainCache(domain)` | Removes all entries for a domain (used after mutations) |
| `clearAllCache()` | Clears all three domains |
| `requestSignature(endpoint, params?)` | Deterministic cache key from endpoint + sorted query params |
| `isCacheDisabled()` / `setCacheDisabled(bool)` | Feature flag stored in `lf_cache_disabled` |
| `handleUserChange(userId)` | Clears all cache on user switch; tracks current user in `lf_cache_user_id` |
| `isStorageAvailable()` | Feature-detects localStorage access |

### Request Deduplication

An in-memory `Map<string, Promise>` prevents duplicate concurrent network requests:

```ts
const inflight = new Map<string, Promise<unknown>>();

export function dedupedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
```

If components A and B both call `getAccounts()` simultaneously before either response lands, only one network request is made. Both callers receive the same promise.

### Cross-Endpoint Cache Reuse

Two functions enable extracting items from already-cached collection responses:

- **`findInCachedCollections<T>(domain, id)`** — Scans all domain cache entries looking for paginated responses that contain an item with the matching `id`. Used by `getAccount(id)`, `getCategory(id)`, `getTransaction(id)`. Avoids a network call when navigating from a list page to a detail page.

- **`findManyInCachedCollections<T>(domain, ids)`** — Same scan but for multiple IDs. Returns all matches only if **every** requested ID is found (all-or-nothing). Used by `getAccountsByIds()`, `getCategoriesByIds()`. Avoids the most frequent redundant request pattern: fetching related entities after loading transactions.

---

## Service Layer Integration

All three services follow an identical read-through caching pattern:

### GET (List) Pattern
```
1. Build signature from endpoint + params
2. Check localStorage cache → return if hit
3. Wrap in dedupedFetch:
   a. fetch() to Next.js API route
   b. If success, write to cache
   c. Return response
```

### GET (Single Item) Pattern
```
1. Build signature from endpoint + id
2. Check localStorage cache → return if hit
3. Check collection cache (findInCachedCollections) → return + promote if hit
4. Wrap in dedupedFetch:
   a. fetch() to API route
   b. If success, write to cache
   c. Return response
```

### GET (By IDs) Pattern
```
1. Build signature from endpoint + id list
2. Check localStorage cache → return if hit
3. Check collection cache (findManyInCachedCollections) → return + promote if all found
4. Fall back to full list fetch (getAccounts/getCategories with ids param)
```

### Mutation Pattern (POST/PUT/DELETE)
```
1. fetch() to API route with method + body
2. If success, clear relevant domain(s)
3. Return response
```

### Cross-Domain Invalidation Matrix

| Mutation | Clears |
|---|---|
| `createAccount` | `accounts` |
| `updateAccount` | `accounts` |
| `deleteAccount` | `accounts` |
| `createCategory` | `categories` |
| `updateCategory` | `categories` |
| `deleteCategory` | `categories` |
| `createTransaction` | `transactions` + `accounts` |
| `updateTransaction` | `transactions` + `accounts` |
| `deleteTransaction` | `transactions` + `accounts` |

Transaction mutations correctly clear both `transactions` and `accounts` (since transactions affect account balances).

---

## HTTP Caching Layer

API route GET handlers set response headers:
```
Cache-Control: private, max-age=60, stale-while-revalidate=300
```

This provides a browser-level cache that works even when localStorage cache is disabled, full, or on the very first load. The `private` directive prevents CDN/proxy caching of user-specific financial data.

---

## User-Facing Cache Controls (`CacheMenu`)

The sidebar/nav exposes three controls:

| Action | Behavior |
|---|---|
| **Sync Data** | `clearAllCache()` → parallel fetch of accounts + categories + transactions(limit=100) → `router.refresh()` |
| **Clear Cache** | `clearAllCache()` only |
| **Disable/Enable** | Sets `lf_cache_disabled=1` in localStorage; when disabling, also clears all cache |

---

## User Isolation

`handleUserChange(userId)` is called on login and logout:
- On **login**: if the new `userId` differs from the stored `lf_cache_user_id`, all cache is cleared. Prevents data leakage between users on shared devices.
- On **logout**: clears all cache and removes the user ID marker.

---

## Identified Issues

### ~BUG-1: `register()` Does Not Call `handleUserChange()` — Not a Bug~

**Status**: Not applicable  
**File**: `services/auth.service.ts`

`register()` only creates the user account — it does not log the user in or set an authenticated session. Therefore there is no user ID to track, and calling `handleUserChange()` is unnecessary.

---

### BUG-2: Inflight Map Entries Can Leak on Never-Settling Promises — Fixed

**Status**: Fixed  
**File**: `lib/cache/index.ts`

`dedupedFetch` now races the fetcher against a 30-second timeout. If the fetch hangs, the timeout rejects the promise, the `.finally()` cleans up the inflight entry, and subsequent requests can proceed normally.

---

### BUG-3: No Cleanup of Expired Entries — Fixed

**Status**: Fixed  
**File**: `lib/cache/index.ts`

A `purgeExpiredEntries()` function was added that scans all domains and removes expired or corrupt entries. It is called on app mount via the `Sidebar` component.

---

### BUG-4: `findInCachedCollections` / `findManyInCachedCollections` Assume Paginated Shape — Fixed

**Status**: Fixed  
**File**: `lib/cache/index.ts`

An `isCollectionKey()` helper was added that inspects the cache key's URL path structure. Keys with 3+ path segments (e.g., `/api/accounts/abc-123`) are identified as detail entries and skipped during collection scans. Only list-endpoint keys (e.g., `/api/accounts`, `/api/accounts?limit=100`) are iterated.

---

## Improvement Opportunities

### ~IMP-1: Add `budgets` Cache Domain — Not Applicable~

**Status**: Skipped  
**Reason**: Budgets are currently mock-only (`MOCK_BUDGETS`). There is no backend API endpoint, no API route, and no budgets service. Adding a cache domain would have nothing to cache. This should be revisited when a real budgets API is implemented.

---

### IMP-2: No localStorage Quota Management — Fixed

**Status**: Fixed  
**File**: `lib/cache/index.ts`

`setCache` now catches quota overflow errors and runs an `evictOldest()` function that removes the oldest cache entries (by timestamp) until enough space is freed, then retries the write. If still full after eviction, the write is silently dropped.

---

### IMP-3: Race Conditions in Component Effects

**Priority**: Medium  
**Impact**: Multiple components use `useEffect` → async fetch → `setState` without request cancellation. In these components, rapid navigation or remounting can cause stale late-arriving responses to overwrite fresher state:

- `app/(app)/accounts/components/RecentTransactions.tsx`
- `app/(app)/accounts/[id]/components/AccountTransactions.tsx`
- `app/(app)/dashboard/components/Transactions.tsx`
- `app/(app)/transactions/components/TransactionsPageContent.tsx`
- `app/(app)/transactions/new/components/NewTransactionContainer.tsx` (type toggle)
- `app/(app)/transactions/[id]/edit/components/EditTransactionContainer.tsx` (type toggle)
- `app/(app)/budgets/[id]/components/BudgetTransactions.tsx`

**Recommendation**: Use an `AbortController` or a `stale` flag pattern in effects:
```ts
useEffect(() => {
  let cancelled = false;
  async function load() {
    const result = await getTransactions({ limit: DEFAULT_LIST_LIMIT });
    if (!cancelled) setTransactions(result.data?.data ?? []);
  }
  load();
  return () => { cancelled = true; };
}, [dependency]);
```

This is a general React best practice and not specific to the cache system, but the async nature of cache-miss fetches makes it directly relevant.

---

### IMP-4: Same-Page Duplicate Fetches

**Priority**: Low (mitigated by deduplication)  
**Impact**: Some pages mount multiple components that fetch overlapping data:

| Page | Overlap |
|---|---|
| Accounts list | `AccountsContent` fetches `getAccounts()`, `RecentTransactions` fetches `getTransactions()` → then `getAccountsByIds()` (overlapping account data) |
| Dashboard | If Budgets panel is re-enabled, it would overlap with Transactions panel on category data |

The `dedupedFetch` mechanism already collapses truly concurrent identical requests, and `findManyInCachedCollections` resolves by-ID lookups from cached collections. So these are **partially mitigated** already.

**Further optimization**: Lift shared data fetching to parent components and pass data down as props. This eliminates parsing/scanning overhead and makes data flow explicit.

---

### IMP-5: Stale-While-Revalidate at Service Layer

**Priority**: Low  
**Impact**: Currently the cache is binary: hit (instant) or miss (blocking fetch). A SWR pattern would return stale data immediately while refreshing in the background, improving perceived performance for returning users.

**Recommendation**: Only worth implementing after confirming that TTL misses cause noticeable latency. The current 15min/24h TTLs combined with manual sync and mutation-based invalidation already provide a good balance.

---

### IMP-6: Cache Key Fragmentation on Filter Combinations

**Priority**: Low  
**Impact**: Different pages fetch transactions with different filter combinations, creating separate cache entries that can't benefit each other:

```
/api/transactions?limit=100                       (transactions page)
/api/transactions?accountId=abc&limit=100         (account detail)
/api/transactions?categoryId=xyz&limit=100&type=EXPENSE  (budget detail)
```

These are fundamentally different queries so separate cache entries are correct. However, the `findManyInCachedCollections` scan iterates all of them on every by-ID lookup.

**Recommendation**: If the number of cached transaction entries grows large, consider an index structure (Map of id → cache key) to make lookups O(1) instead of scanning all entries.

---

## Assessment: Is This the Right Approach?

### What the current design gets right

1. **Domain-scoped localStorage with TTL** is a solid choice for a client-heavy SPA with a backend API. It's simple, debuggable, and requires no additional dependencies.

2. **Request deduplication** via inflight Map elegantly handles the concurrent-mount problem inherent to React's component model.

3. **Cross-endpoint reuse** (collection → single/subset) is a high-value optimization that eliminates the most common redundant request pattern (list → detail navigation).

4. **Cacheable response wrapping** — caching the full `ProxyResponse<T>` (including `status` and `error`) means consumers don't need to know if data came from cache or network.

5. **Mutation-based invalidation** is simple and correct. `clearDomainCache` after any write ensures subsequent reads are fresh.

6. **User isolation** via `handleUserChange` prevents data leakage between users.

7. **Feature flag** (`setCacheDisabled`) enables debugging and testing without code changes.

### Where alternative approaches might be better

| Concern | Alternative | Trade-off |
|---|---|---|
| Manual cache management in every service | **SWR/React Query** — automatic cache, dedup, revalidation, and GC | Adds a dependency (~12KB) but eliminates all hand-written cache code. Handles stale-while-revalidate, window focus revalidation, retry, and error boundaries out of the box. |
| localStorage 5MB limit | **IndexedDB** (via `idb-keyval` or similar) | Much larger quota (typically ~50MB+), async API, structured data. But adds complexity for what is currently a small dataset. |
| No SSR cache | **Next.js `fetch` with `next: { revalidate }`** in Server Components | Would enable server-side caching and ISR. But the current architecture uses client-side fetching from `useEffect`, so this would require significant refactoring. |
| Component-level state management | **React Context or Zustand** for shared cache state | Would solve the parent-child data sharing problem and enable reactive cache invalidation. But the current approach of each component managing its own state is simpler for the current scale. |

### Verdict

The current approach is **appropriate for the app's complexity and scale**. It's a well-structured, dependency-free cache layer that covers the most important scenarios. The bugs identified (BUG-1 through BUG-4) are edge cases, not architectural flaws.

**If the app grows significantly** (more domains, more complex filter combinations, SSR requirements), migrating to React Query or SWR would be the recommended next step — it would replace `lib/cache/index.ts` entirely and eliminate the manual cache management in every service file.

---

## Summary of Action Items

| ID | Type | Priority | Effort | Description |
|---|---|---|---|---|
| BUG-1 | ~Not a bug~ | — | — | `register()` doesn't login, no `handleUserChange` needed |
| BUG-2 | Bug | Fixed | ~10 lines | Added 30s timeout to `dedupedFetch` via `Promise.race` |
| BUG-3 | Bug | Fixed | ~20 lines | Added `purgeExpiredEntries()`, called on app mount |
| BUG-4 | Bug | Fixed | ~10 lines | `isCollectionKey()` filter skips detail entries in scans |
| IMP-1 | ~Skipped~ | — | — | Budgets are mock-only, no API to cache |
| IMP-2 | Improvement | Fixed | ~20 lines | LRU eviction via `evictOldest()` on quota overflow |
| IMP-3 | Improvement | Fixed | ~2 lines/component | Cancellation signals in 7 components' async effects |
| IMP-4 | Improvement | Low | Refactor | Lift shared fetches to parent components |
| IMP-5 | Improvement | Low | ~20 lines | Optional SWR pattern at service layer |
| IMP-6 | Improvement | Low | ~20 lines | Optional index structure for collection scans |
