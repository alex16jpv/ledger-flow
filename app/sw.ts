import { defaultCache } from "@serwist/next/worker";
import {
  NetworkFirst,
  NetworkOnly,
  type PrecacheEntry,
  Serwist,
  type SerwistGlobalConfig,
  type SerwistPlugin,
  type Strategy,
} from "serwist";

import { OUTBOX_SYNC_TAG } from "@/lib/local/outbox/tag";
import {
  isShellPath,
  offlineDocument,
  SHELL_CACHE,
  SHELL_RSC_CACHE,
  shellCacheKey,
  WARM_SHELL_MESSAGE,
  type WarmShellMessage,
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

// A filter, a month or Next's `_rsc` token change the URL and not the answer, so every request for
// a route shares one entry and changing a filter with no network still finds it (F-06).
const byRoute: SerwistPlugin = {
  cacheKeyWillBeUsed: ({ request }) => Promise.resolve(shellCacheKey(request.url)),
};

// Next varies its RSC answers on headers the router does not repeat on every request; matching on
// them would leave every warmed entry unreachable.
const shellRsc: NetworkFirst = new NetworkFirst({
  cacheName: SHELL_RSC_CACHE,
  plugins: [byRoute],
  matchOptions: { ignoreVary: true },
});

const shellPages: NetworkFirst = new NetworkFirst({
  cacheName: SHELL_CACHE,
  plugins: [
    byRoute,
    {
      // Neither the network nor the cache has this route: the app answers with its own document
      // rather than letting the browser show its error page (§6 O-F6).
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
        sameOrigin && request.headers.get("RSC") === "1" && isShellPath(url.pathname),
      handler: shellRsc,
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

// The other half of Background Sync: the engine registers this tag when a pass ends with the queue
// still full, and the drain itself lives in the page (F-24).
self.addEventListener("sync", (event) => {
  if (event.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) client.postMessage({ type: OUTBOX_SYNC_TAG });
    }),
  );
});

async function warmRoute(strategy: Strategy, request: Request, event: ExtendableEvent) {
  const cache = await caches.open(strategy.cacheName);
  if (await cache.match(shellCacheKey(request.url), { ignoreVary: true })) return;
  await strategy.handle({ request, event }).catch(() => undefined);
}

// The routes the user has not opened yet: without this, the first visit with no network has nothing
// to answer with (§6 O-F6). Already cached routes are left alone, so opening the app costs nothing.
async function warmShell(urls: string[], event: ExtendableEvent): Promise<void> {
  for (const url of urls) {
    await warmRoute(shellPages, new Request(url, { credentials: "same-origin" }), event);
    await warmRoute(
      shellRsc,
      new Request(url, { credentials: "same-origin", headers: { RSC: "1" } }),
      event,
    );
  }
}

self.addEventListener("message", (event) => {
  const data = event.data as Partial<WarmShellMessage> | null;
  if (data?.type !== WARM_SHELL_MESSAGE) return;
  event.waitUntil(warmShell(data.urls ?? [], event));
});

// A new worker ships new chunks, so the documents the old one warmed point at files that are gone.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([caches.delete(SHELL_CACHE), caches.delete(SHELL_RSC_CACHE)]).then(() => undefined),
  );
});
