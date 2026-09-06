import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

// The e2e build is flagged as "test", so the app does not install the worker by itself: the suite
// registers it to exercise what a production install would do.
async function installWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// The documents the worker holds: with no network every navigation loads one (F-51).
async function warmedRoutes(page: Page, cacheName: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  }, cacheName);
}

test("the shell navigates with no network, filters included, and falls back on a route it never saw", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await installWorker(page);

  // 18 static routes and 7 detail templates (lib/pwa/shell.ts).
  await expect
    .poll(async () => (await warmedRoutes(page, "app-shell")).length, { timeout: 60_000 })
    .toBeGreaterThanOrEqual(25);
  const warmed = await warmedRoutes(page, "app-shell");
  expect(warmed).toContain("/transactions");
  expect(warmed).toContain("/budgets");
  expect(warmed).toContain("/accounts");
  // F-47: the forms that create a row, and the inbox every quick capture lands in.
  expect(warmed).toContain("/accounts/new");
  expect(warmed).toContain("/transactions/review");
  // F-48: a detail route is cached once, by template, so any id answers.
  expect(warmed).toContain("/transactions/[id]");
  // A row of the seed month, which no other spec of the suite creates or deletes while this runs.
  const seeded = await request.get(
    "/api/transactions?from=2026-08-01T00:00:00.000Z&to=2026-08-31T00:00:00.000Z&limit=1",
  );
  const [row] = ((await seeded.json()) as { data: { id: string }[] }).data;
  expect(row).toBeDefined();
  // The detail below is answered by the mirror, which only answers once a pull has drained.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const name = (await indexedDB.databases())
            .map((info) => info.name ?? "")
            .find((candidate) => candidate.startsWith("lf-vault-"));
          if (!name) return null;
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open(name);
            open.onsuccess = () => {
              resolve(open.result);
            };
            open.onerror = () => {
              reject(open.error ?? new Error("open failed"));
            };
          });
          const stamp = await new Promise<unknown>((resolve) => {
            const get = db.transaction("meta").objectStore("meta").get("syncedAt");
            get.onsuccess = () => {
              resolve(get.result);
            };
          });
          db.close();
          return stamp ? "drained" : null;
        }),
      { timeout: 60_000 },
    )
    .not.toBeNull();

  await page.context().setOffline(true);

  await page.getByRole("link", { name: "Transactions" }).first().click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();

  // F-06: the filter only changes the query string, which used to miss every cached entry.
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page).toHaveURL(/type=EXPENSE/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/type=EXPENSE/);
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();

  await page.getByRole("link", { name: "Budgets" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();

  await page.getByRole("link", { name: "Accounts" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();

  await page.getByRole("link", { name: "Home" }).first().click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 20_000 });
  // A failed RSC hop falls back to a full load, which would interrupt the next one.
  await page.waitForLoadState("load");

  // F-48: a row nobody opened on this device before the network went — its detail comes from the
  // template entry, and the row itself from the mirror.
  await page.goto(`/transactions/${row!.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Transaction" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

  // A route the warm-up does not cover: the app's own document answers, not the browser's error page.
  await page.goto("/settings/nowhere");
  await expect(page.getByRole("heading", { level: 1, name: /offline/i })).toBeVisible();
});
