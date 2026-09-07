import { defaultCache } from "@serwist/next/worker";
import {
  NetworkFirst,
  NetworkOnly,
  type PrecacheEntry,
  Serwist,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from "serwist";

import { OUTBOX_SYNC_TAG } from "@/lib/local/outbox/tag";
import {
  isShellPath,
  offlineDocument,
  SHELL_CACHE,
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

// A filter, a month or Next's `_rsc` token change the URL and not the answer, so every request for
// a route shares one entry and changing a filter with no network still finds it (F-06); a row's id
// folds into its route template the same way (F-48).
const byRoute: SerwistPlugin = {
  cacheKeyWillBeUsed: ({ request }) => Promise.resolve(shellCacheKey(request.url)),
};

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
    // An RSC payload is never served from a cache: the router reads the URL and the rewrite headers
    // of the response it gets, and a cached one names the route it was stored under, not the one
    // asked for — with no network it then chases a rewrite that never happened, or keeps the old
    // URL. Failing the hop instead makes the router load the document, which the cache answers.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.headers.get("RSC") === "1" && isShellPath(url.pathname),
      handler: new NetworkOnly(),
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
// still full, and the drain itself lives in the page (F-24). **The tag only brings the drain
// forward while a tab is alive** (F-39, owner's decision 2026-09-06): woken with no clients,
// `matchAll` answers an empty list and the queue waits for the next time the app is opened, which
// costs the user nothing — nothing is lost, it is sent later. Draining from here would mean a second
// copy of the engine, its routes and its access to the vault, which is the most delicate code in the
// app and the last place to duplicate it.
self.addEventListener("sync", (event) => {
  if (event.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      for (const client of clients) client.postMessage({ type: OUTBOX_SYNC_TAG });
    }),
  );
});

async function warmRoute(request: Request, event: ExtendableEvent) {
  const cache = await caches.open(SHELL_CACHE);
  if (await cache.match(shellCacheKey(request.url), { ignoreVary: true })) return;
  await shellPages.handle({ request, event }).catch(() => undefined);
}

// The routes the user has not opened yet: without this, the first visit with no network has nothing
// to answer with (§6 O-F6). Already cached routes are left alone, so opening the app costs nothing.
async function warmShell(urls: string[], event: ExtendableEvent): Promise<void> {
  for (const url of urls) {
    await warmRoute(new Request(url, { credentials: "same-origin" }), event);
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

// A new worker ships new chunks, so the documents the old one warmed point at files that are gone.
// They are fetched again while this worker installs — the one moment a new build is guaranteed to
// have the network, and the page's cookies — into a staging cache, and swapped in on activate. A
// route that cannot be fetched now is dropped: a stale document would ask for chunks that no longer
// exist, which is worse than the offline page.
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
  event.waitUntil(swapShell(SHELL_CACHE));
});
