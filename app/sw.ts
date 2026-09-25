import { defaultCache } from "@serwist/next/worker";
import {
  NetworkFirst,
  NetworkOnly,
  type PrecacheEntry,
  Serwist,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";

import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { APP_HOME_PATH } from "@/lib/auth/routes";
import { localeOf, localePrefix } from "@/lib/i18n/locales";
import { OUTBOX_SYNC_TAG } from "@/lib/local/outbox/tag";
import {
  isLandingPath,
  isShellPath,
  offlineDocument,
  rewrittenPath,
  SHELL_CACHE,
  SHELL_RSC_CACHE,
  SHELL_WARMED_MESSAGE,
  shellCacheKey,
  WARM_SHELL_MESSAGE,
  type WarmShellMessage,
  warmUrlFor,
} from "@/lib/pwa/shell";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    // Next's build id, written in by `serwist.config.mjs`.
    __BUILD_ID: string;
  }
  // Background Sync is not in TypeScript's worker lib yet.
  interface SyncEvent extends ExtendableEvent {
    readonly tag: string;
  }
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
  }
}

declare const self: ServiceWorkerGlobalScope;

// F-06: filters, months and `_rsc` change the URL, not the answer, so a route is one entry (F-48).
const byRoute: SerwistPlugin = {
  cacheKeyWillBeUsed: ({ request }) => Promise.resolve(shellCacheKey(request.url)),
};

// Without the session marker the proxy answers every screen with the login, which no screen may keep.
function isOwnAnswer(response: Response): boolean {
  return response.status === 200 && !response.redirected;
}

const ownAnswerOnly: SerwistPlugin = {
  cacheWillUpdate: ({ response }) => Promise.resolve(isOwnAnswer(response) ? response : null),
};

// An unread body holds its connection, and six of them stall every later fetch of the worker.
async function release(response: Response | null | undefined): Promise<void> {
  if (response?.body && !response.bodyUsed) await response.body.cancel();
}

const shellPages: NetworkFirst = new NetworkFirst({
  cacheName: SHELL_CACHE,
  plugins: [
    byRoute,
    ownAnswerOnly,
    {
      // §6 O-F6: with neither network nor cache for this route, the app answers its own document.
      handlerDidError: ({ request }): Promise<Response | undefined> =>
        serwist.matchPrecache(offlineDocument(new URL(request.url).pathname)),
    },
  ],
  matchOptions: { ignoreVary: true },
});

// Data lives in React Query's persisted cache, never in the worker: /api is always network-only.
const serwist: Serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ url }) => url.pathname.startsWith("/api/"), handler: new NetworkOnly() },
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && isNavigationPayload(request) && isShellPath(url.pathname),
      handler: { handle: rscNavigation },
    },
    // A prefetch's payload is the route's loading state, not its render: never cached, never served.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.headers.get(RSC_HEADER) === "1" && isShellPath(url.pathname),
      handler: new NetworkOnly(),
    },
    // P-33: a signed-in device never gets the landing document, so the worker redirects it itself.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.mode === "navigate" && isLandingPath(url.pathname),
      handler: { handle: rootNavigation },
    },
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.mode === "navigate" && isShellPath(url.pathname),
      handler: shellPages,
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

// F-39 (owner, 2026-09-06): the tag only brings the drain forward while a tab is alive (F-24).
self.addEventListener("sync", (event) => {
  if (event.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) client.postMessage({ type: OUTBOX_SYNC_TAG });
    }),
  );
});

// §2.6: in a worker the marker is readable only through the Cookie Store API, missing in Safari.
async function holdsTheApp(): Promise<boolean> {
  const store = (self as unknown as { cookieStore?: { get: (name: string) => Promise<unknown> } })
    .cookieStore;
  if (!store) return false;
  try {
    return Boolean(await store.get(SESSION_COOKIE));
  } catch {
    return false;
  }
}

const network: NetworkOnly = new NetworkOnly();

// Next's own header names, which it does not export from anywhere public.
const RSC_HEADER = "RSC";
const RSC_QUERY = "_rsc";
const RSC_CONTENT_TYPE = "text/x-component";
const PREFETCH_HEADERS = ["Next-Router-Prefetch", "Next-Router-Segment-Prefetch"] as const;
const REWRITTEN_PATH_HEADER = "x-nextjs-rewritten-path";

function isNavigationPayload(request: Request): boolean {
  return (
    request.headers.get(RSC_HEADER) === "1" &&
    PREFETCH_HEADERS.every((header) => !request.headers.has(header))
  );
}

// With no router headers Next expects an empty `_rsc`, and redirects any request without one to it.
function payloadRequest(url: string): Request {
  const target = new URL(url);
  target.searchParams.set(RSC_QUERY, "");
  return new Request(target, { credentials: "same-origin", headers: { [RSC_HEADER]: "1" } });
}

// Built again, not handed over: a fresh `Response` has no URL, so the router resolves the one it asked for.
function rebase(cached: Response, pathname: string): Response {
  const headers = new Headers(cached.headers);
  const rewritten = rewrittenPath(pathname);
  if (rewritten === null) headers.delete(REWRITTEN_PATH_HEADER);
  else headers.set(REWRITTEN_PATH_HEADER, rewritten);
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

async function warmedPayload(url: string): Promise<Response | undefined> {
  const cache = await caches.open(SHELL_RSC_CACHE);
  const cached = await cache.match(shellCacheKey(url), { ignoreVary: true });
  return cached && rebase(cached, new URL(url).pathname);
}

// A page opened after a deploy can be newer than these payloads, and Next reloads on a build mismatch.
function newBuildPending(): boolean {
  return self.registration.installing !== null || self.registration.waiting !== null;
}

// T-195: only the warm fills the cache, and it answers first; a navigation's own answer is never kept.
async function rscNavigation({
  request,
  event,
}: {
  request: Request;
  event: ExtendableEvent;
}): Promise<Response> {
  const warmed = newBuildPending() ? undefined : await warmedPayload(request.url);
  if (warmed) return warmed;
  try {
    return await network.handle({ request, event });
  } catch (error) {
    const fallback = await warmedPayload(request.url);
    if (!fallback) throw error;
    return fallback;
  }
}

async function storePayload(cacheName: string, url: string, event: ExtendableEvent): Promise<void> {
  const response = await network.handle({ request: payloadRequest(url), event }).catch(() => null);
  const payload = response?.headers.get("content-type")?.startsWith(RSC_CONTENT_TYPE) ?? false;
  if (response && payload && isOwnAnswer(response)) {
    await (await caches.open(cacheName)).put(shellCacheKey(url), response);
    return;
  }
  await release(response);
}

function fetchDocument(strategy: NetworkFirst, url: string, event: ExtendableEvent): Promise<void> {
  return strategy
    .handle({ request: new Request(url, { credentials: "same-origin" }), event })
    .then(release, () => undefined);
}

async function rootNavigation({
  request,
  event,
}: {
  request: Request;
  event: ExtendableEvent;
}): Promise<Response> {
  try {
    return await network.handle({ request, event });
  } catch {
    if (await holdsTheApp()) {
      const url = new URL(request.url);
      return Response.redirect(
        `${url.origin}${localePrefix(localeOf(url.pathname))}${APP_HOME_PATH}`,
      );
    }
    return shellPages.handle({ request, event });
  }
}

async function warmRoute(url: string, event: ExtendableEvent) {
  const documents = await caches.open(SHELL_CACHE);
  const key = shellCacheKey(url);
  if (!(await documents.match(key, { ignoreVary: true }))) {
    await fetchDocument(shellPages, url, event);
  }
  const payloads = await caches.open(SHELL_RSC_CACHE);
  if (await payloads.match(key, { ignoreVary: true })) return;
  await storePayload(SHELL_RSC_CACHE, url, event);
}

// §6 O-F6: without this the first visit with no network has nothing to answer with.
async function warmShell(urls: string[], event: ExtendableEvent): Promise<void> {
  for (const url of urls) {
    await warmRoute(url, event);
  }
}

self.addEventListener("message", (event) => {
  const data = event.data as Partial<WarmShellMessage> | null;
  if (data?.type !== WARM_SHELL_MESSAGE) return;
  const source = event.source;
  event.waitUntil(
    warmShell(data.urls ?? [], event).then(() => {
      source?.postMessage({ type: SHELL_WARMED_MESSAGE });
    }),
  );
});

const STAGED = "-next";

// A worker still waiting keeps its own staging while a newer build installs beside it.
function stagingOf(cacheName: string): string {
  return `${cacheName}${STAGED}-${self.__BUILD_ID}`;
}

// A new build's chunks replace the old, so the shell is refetched on install and staged, not kept.
async function stageShell(event: ExtendableEvent): Promise<void> {
  await Promise.all([SHELL_CACHE, SHELL_RSC_CACHE].map((name) => caches.delete(stagingOf(name))));
  const live = await caches.open(SHELL_CACHE);
  const staging = new NetworkFirst({
    cacheName: stagingOf(SHELL_CACHE),
    plugins: [byRoute, ownAnswerOnly],
    matchOptions: { ignoreVary: true },
  });
  for (const key of await live.keys()) {
    await fetchDocument(staging, warmUrlFor(key.url), event);
  }
  const payloads = await caches.open(SHELL_RSC_CACHE);
  for (const key of await payloads.keys()) {
    await storePayload(stagingOf(SHELL_RSC_CACHE), warmUrlFor(key.url), event);
  }
}

async function swapShell(cacheName: string): Promise<void> {
  await caches.delete(cacheName);
  const staged = await caches.open(stagingOf(cacheName));
  const live = await caches.open(cacheName);
  for (const key of await staged.keys()) {
    const response = await staged.match(key);
    if (response) await live.put(key, response);
  }
  const leftovers = (await caches.keys()).filter((name) =>
    name.startsWith(`${cacheName}${STAGED}`),
  );
  await Promise.all(leftovers.map((name) => caches.delete(name)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(stageShell(event));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([swapShell(SHELL_CACHE), swapShell(SHELL_RSC_CACHE)]));
});
