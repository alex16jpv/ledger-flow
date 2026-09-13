import { expect, type Page, test } from "../fixtures";
import { freshUser, keptDocument, markDocument, readyForOffline, signInAs } from "../offline";
import { SW_PATH } from "../sw-path";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

// The e2e build is flagged `test`, so the suite registers the worker itself.
async function installWorker(page: Page) {
  await page.evaluate((path) => navigator.serviceWorker.register(path, { scope: "/" }), SW_PATH);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// The documents the worker holds: one answers a navigation the RSC cache cannot (T-01).
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
  // The app's own start-up navigation runs on mount and would interrupt this one (F-45).
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  // F-48: the detail comes from the template entry and the row from the mirror.
  await page.goto(`/transactions/${row!.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Transaction" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

  // A route the warm-up does not cover: the app's own document answers, not the browser's error page.
  await page.goto("/settings/nowhere");
  await expect(page.getByRole("heading", { level: 1, name: /offline/i })).toBeVisible();
});

// T-01: without the payload cache the hop fails and the router reloads the whole document.
test("with no network a navigation stays inside the app instead of reloading it", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "soft-nav");
  await signInAs(context, request, user);
  const created = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      amount: 4321,
      type: "EXPENSE",
      date: new Date().toISOString(),
      description: "SOFT NAV row",
      fromAccountId: user.accountId,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);

  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);
  await expect
    .poll(
      async () =>
        page.evaluate(async () =>
          (await caches.open("app-shell-rsc")).keys().then((k) => k.length),
        ),
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(25);

  await context.setOffline(true);
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await markDocument(page);

  await page.getByRole("link", { name: "Budgets" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible({
    timeout: 20_000,
  });
  expect(await keptDocument(page)).toBe(true);

  // F-06 again, now without a reload: the filter only changes the query, and one entry answers it.
  await page.getByRole("link", { name: "Transactions" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page).toHaveURL(/type=EXPENSE/, { timeout: 20_000 });
  expect(await keptDocument(page)).toBe(true);

  // F-48: one template entry answers every row, so the URL and the screen must be this row's.
  const row = page.getByRole("button", { name: /SOFT NAV row/ }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Transaction", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("SOFT NAV row")).toBeVisible();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}$/);
  expect(await keptDocument(page)).toBe(true);

  await page.getByRole("link", { name: "Edit" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}\/edit$/);
  expect(await keptDocument(page)).toBe(true);

  await page.goBack();
  await expect(
    page.getByRole("heading", { level: 1, name: "Transaction", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  expect(await keptDocument(page)).toBe(true);
});
