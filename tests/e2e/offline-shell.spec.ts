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

// Both halves of a route: the document a reload needs and the RSC payload a click needs.
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

  for (const cacheName of ["app-shell", "app-shell-rsc"]) {
    await expect
      .poll(async () => (await warmedRoutes(page, cacheName)).length, { timeout: 60_000 })
      .toBeGreaterThanOrEqual(9);
    const warmed = await warmedRoutes(page, cacheName);
    expect(warmed, cacheName).toContain("/transactions");
    expect(warmed, cacheName).toContain("/budgets");
    expect(warmed, cacheName).toContain("/accounts");
  }

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

  // A route the warm-up does not cover: the app's own document answers, not the browser's error page.
  await page.goto("/transactions/00000000-0000-7000-8000-000000000404");
  await expect(page.getByRole("heading", { level: 1, name: /offline/i })).toBeVisible();
});
