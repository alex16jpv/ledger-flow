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

const shellPages: NetworkFirst = new NetworkFirst({
  cacheName: SHELL_CACHE,
  plugins: [
    byRoute,
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
const PREFETCH_HEADERS = ["Next-Router-Prefetch", "Next-Router-Segment-Prefetch"] as const;
const REWRITTEN_PATH_HEADER = "x-nextjs-rewritten-path";

function isNavigationPayload(request: Request): boolean {
  return (
    request.headers.get(RSC_HEADER) === "1" &&
    PREFETCH_HEADERS.every((header) => !request.headers.has(header))
  );
}

function payloadRequest(url: string): Request {
  return new Request(url, { credentials: "same-origin", headers: { [RSC_HEADER]: "1" } });
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

// A navigation's own answer is never cached: it is only the part of the tree that changed (T-01).
async function rscNavigation({
  request,
  event,
}: {
  request: Request;
  event: ExtendableEvent;
}): Promise<Response> {
  try {
    return await network.handle({ request, event });
  } catch (error) {
    const cache = await caches.open(SHELL_RSC_CACHE);
    const cached = await cache.match(shellCacheKey(request.url), { ignoreVary: true });
    if (!cached) throw error;
    return rebase(cached, new URL(request.url).pathname);
  }
}

async function storePayload(cacheName: string, url: string, event: ExtendableEvent): Promise<void> {
  const response = await network.handle({ request: payloadRequest(url), event }).catch(() => null);
  if (response?.ok) await (await caches.open(cacheName)).put(shellCacheKey(url), response);
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
    await shellPages
      .handle({ request: new Request(url, { credentials: "same-origin" }), event })
      .catch(() => undefined);
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

// A new build's chunks replace the old, so the shell is refetched on install and staged, not kept.
async function stageShell(event: ExtendableEvent): Promise<void> {
  const live = await caches.open(SHELL_CACHE);
  const staging = new NetworkFirst({
    cacheName: `${SHELL_CACHE}${STAGED}`,
    plugins: [byRoute],
    matchOptions: { ignoreVary: true },
  });
  for (const key of await live.keys()) {
    const request = new Request(warmUrlFor(key.url), { credentials: "same-origin" });
    await staging.handle({ request, event }).catch(() => undefined);
  }
  const payloads = await caches.open(SHELL_RSC_CACHE);
  for (const key of await payloads.keys()) {
    await storePayload(`${SHELL_RSC_CACHE}${STAGED}`, warmUrlFor(key.url), event);
  }
}

async function swapShell(cacheName: string): Promise<void> {
  await caches.delete(cacheName);
  const staged = await caches.open(`${cacheName}${STAGED}`);
  const live = await caches.open(cacheName);
  for (const key of await staged.keys()) {
    const response = await staged.match(key);
    if (response) await live.put(key, response);
  }
  await caches.delete(`${cacheName}${STAGED}`);
}

self.addEventListener("install", (event) => {
  event.waitUntil(stageShell(event));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([swapShell(SHELL_CACHE), swapShell(SHELL_RSC_CACHE)]));
});
