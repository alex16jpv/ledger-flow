import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { freshUser, readyForOffline, signInAs, vaultState } from "../offline";

const STRIPE = "A new version of Ledger Flow is ready.";

interface HeldVault {
  prefix: string;
  schemaVersion: number;
  mirrorVersion: number;
  outboxVersion: number;
}

function heldVault(page: Page): Promise<HeldVault | null> {
  return page.evaluate(async () => {
    const { held = [] } = await navigator.locks.query();
    const name = held
      .map((lock) => lock.name ?? "")
      .find((candidate) => candidate.startsWith("lf-vault-"));
    if (!name) return null;
    const [prefix = "", versions = ""] = name.split(":");
    const [schemaVersion = 0, mirrorVersion = 0, outboxVersion = 0] = versions
      .split(".")
      .map(Number);
    return { prefix, schemaVersion, mirrorVersion, outboxVersion };
  });
}

async function syncedVault(page: Page): Promise<HeldVault> {
  await expect
    .poll(async () => (await vaultState(page))?.syncedAt, { timeout: 60_000 })
    .toEqual(expect.any(String));
  await expect.poll(() => heldVault(page)).not.toBeNull();
  const held = await heldVault(page);
  if (!held) throw new Error("no tab holds the copy");
  return held;
}

function storedMirrorVersion(page: Page, database: string): Promise<unknown> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onsuccess = () => {
        resolve(open.result);
      };
      open.onerror = () => {
        reject(open.error ?? new Error("open failed"));
      };
    });
    const value = await new Promise<unknown>((resolve) => {
      const get = db.transaction("meta").objectStore("meta").get("mirrorVersion");
      get.onsuccess = () => {
        resolve((get.result as { value?: unknown } | undefined)?.value);
      };
    });
    db.close();
    return value;
  }, database);
}

// T-171: an older tab used to reset a newer copy, and the newer one reset it back.
test("a tab of an older build lets the copy go and asks for a reload", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120_000);
  const who = await freshUser(request, "older-tab");
  await signInAs(context, request, who);
  await page.goto("/home");
  const held = await syncedVault(page);
  const userId = held.prefix.slice("lf-vault-".length);

  await page.evaluate(
    (message) => {
      const channel = new BroadcastChannel("lf");
      channel.postMessage(message);
      channel.close();
    },
    {
      type: "vault:opening",
      userId,
      schemaVersion: held.schemaVersion,
      mirrorVersion: held.mirrorVersion + 1,
      outboxVersion: held.outboxVersion,
    },
  );

  await expect(page.getByText(STRIPE)).toBeVisible();
  await expect.poll(() => heldVault(page)).toBeNull();
});

test("a tab of an older build never resets a copy a newer tab holds", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120_000);
  const who = await freshUser(request, "newer-holds");
  await signInAs(context, request, who);
  await page.goto("/home");
  const held = await syncedVault(page);
  const database = held.prefix;
  const newer = held.mirrorVersion + 1;

  const other = await context.newPage();
  await other.goto("/privacy");
  await other.evaluate(
    async ({ name, lock, version }) => {
      void navigator.locks.request(lock, { mode: "shared" }, () => new Promise(() => undefined));
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => {
          resolve(open.result);
        };
        open.onerror = () => {
          reject(open.error ?? new Error("open failed"));
        };
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction("meta", "readwrite");
        tx.objectStore("meta").put({ key: "mirrorVersion", value: version });
        tx.oncomplete = () => {
          resolve();
        };
      });
      db.close();
    },
    {
      name: database,
      lock: `${database}:${String(held.schemaVersion)}.${String(newer)}.${String(held.outboxVersion)}`,
      version: newer,
    },
  );

  await page.reload();

  await expect(page.getByText(STRIPE)).toBeVisible();
  expect(await storedMirrorVersion(page, database)).toBe(newer);
  expect((await vaultState(page))?.syncedAt).toEqual(expect.any(String));
});

const BUILD_ID = readFileSync(
  `${process.env.NEXT_DIST_DIR ?? ".next-e2e"}/BUILD_ID`,
  "utf8",
).trim();
const ROUTE = "/stats/trends";

function shellKeys(page: Page, cacheName: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  }, cacheName);
}

async function warm(page: Page, path: string): Promise<void> {
  await page.evaluate(async (route) => {
    const registration = await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      const done = (event: MessageEvent) => {
        if ((event.data as { type?: string } | null)?.type !== "ledger-flow-shell-warmed") return;
        navigator.serviceWorker.removeEventListener("message", done);
        resolve();
      };
      navigator.serviceWorker.addEventListener("message", done);
      registration.active?.postMessage({
        type: "ledger-flow-warm-shell",
        urls: [`${window.location.origin}${route}`],
      });
    });
  }, path);
}

// Navigations come through navigation preload, which no route sees; the warm is the worker's own fetch.
test("the worker keeps only its own build's documents and payloads", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const who = await freshUser(request, "own-build");
  await signInAs(context, request, who);
  await page.goto("/home");
  await readyForOffline(page);
  await page.evaluate(async (path) => {
    for (const name of ["app-shell", "app-shell-rsc"]) {
      const cache = await caches.open(name);
      for (const key of await cache.keys()) {
        if (new URL(key.url).pathname === path) await cache.delete(key);
      }
    }
  }, ROUTE);

  // A deploy between this worker's install and the next: the server answers the newer build.
  let answered = 0;
  await context.route(`**${ROUTE}*`, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replaceAll(BUILD_ID, "a-newer-build");
    answered += 1;
    return route.fulfill({ response, body });
  });
  await warm(page, ROUTE);
  expect(answered).toBe(2);
  expect(await shellKeys(page, "app-shell")).not.toContain(ROUTE);
  expect(await shellKeys(page, "app-shell-rsc")).not.toContain(ROUTE);

  await context.unroute(`**${ROUTE}*`);
  await warm(page, ROUTE);
  expect(await shellKeys(page, "app-shell")).toContain(ROUTE);
  expect(await shellKeys(page, "app-shell-rsc")).toContain(ROUTE);
});

test("a tab still on the replaced build finds its chunks after another tab's Reload", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const who = await freshUser(request, "previous-chunks");
  await signInAs(context, request, who);
  await page.goto("/home");
  await readyForOffline(page);
  const chunk = "/_next/static/chunks/t171-previous-build.js";
  await page.evaluate(async (path) => {
    const name = (await caches.keys()).find((candidate) => candidate.includes("precache"));
    if (!name) throw new Error("no precache");
    await (await caches.open(name)).put(path, new Response("previous build"));
  }, chunk);

  await page.evaluate(async (path) => {
    const registration = await navigator.serviceWorker.register(`${path}?build=next`, {
      scope: "/",
    });
    await new Promise<void>((resolve) => {
      const check = () => {
        if (registration.waiting) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }, process.env.NEXT_PUBLIC_SW_PATH ?? "/sw.js");
  // Staged until the activation, so a waiting or failed install leaves the active worker's set alone.
  expect(await shellKeys(page, "app-static-previous")).not.toContain(chunk);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          resolve();
        },
        { once: true },
      );
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  });

  // The controller changes as the activation starts; its swap finishes inside `activate`.
  await expect.poll(() => shellKeys(page, "app-static-previous")).toContain(chunk);
  const answer = await page.goto(chunk);
  expect(answer?.fromServiceWorker()).toBe(true);
  expect(answer?.status()).toBe(200);
  expect(await answer?.text()).toBe("previous build");
});
