import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

import { SW_PATH } from "./sw-path";

// `playwright.config.ts` puts this on the runner too: in CI the app is on another port, and a wrong
// origin here is a `403 UNTRUSTED_ORIGIN` from the BFF on the very first request of every spec.
export const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

export interface Row {
  id: string;
  amount: number;
  type: string;
  date: string;
  description: string | null;
  note?: string | null;
  categoryId: string | null;
  fromAccountId: string | null;
  pendingDetails: boolean;
  updatedAt: string;
}

export interface AccountRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  balance: number;
  archivedAt: string | null;
  updatedAt: string;
}

export const uniqueAmount = (): number => 100_000 + Math.floor(Math.random() * 899_999);

export interface Credentials {
  email: string;
  password: string;
}

export interface Fixture extends Credentials {
  accountId: string;
  accountName: string;
  openingBalance: number;
}

// A user of its own for each test. The seeded one is shared by the whole suite, and these specs
// count rows, compare balances and let two devices disagree about one row: on a shared user every
// one of those assertions is a race with whatever else is running (F-45 is that lesson already).
// Registration signs `request` in, so its cookies are this user's from here on.
// F-11: a keep-alive socket the server is closing while the request context reuses it answers
// `read ECONNRESET`, which has nothing to do with what the test is checking. One retry is enough:
// the calls that go through here are a login, a registration and two reads.
async function retryOnReset<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!String(error).includes("ECONNRESET")) throw error;
    return await call();
  }
}

export interface FreshUserOptions {
  openingBalance?: number;
  // Left out, the backend's defaults — the same the app falls back to, which is what hides F-63.
  currency?: string;
  timezone?: string;
}

export async function freshUser(
  request: APIRequestContext,
  tag: string,
  { openingBalance = 5_000_000, currency, timezone }: FreshUserOptions = {},
): Promise<Fixture> {
  const email = `e2e-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@ledgerflow.test`;
  const password = "LedgerFlow!2026";
  const registered = await retryOnReset(() =>
    request.post("/api/auth/register", {
      headers: { origin: APP },
      data: {
        name: `Offline ${tag}`,
        email,
        password,
        ...(currency ? { currency } : {}),
        ...(timezone ? { timezone } : {}),
      },
    }),
  );
  expect(registered.ok(), await registered.text()).toBe(true);
  const accountName = "Cash";
  const created = await retryOnReset(() =>
    request.post("/api/accounts", {
      headers: { origin: APP },
      data: { name: accountName, type: "CASH", balance: openingBalance },
    }),
  );
  expect(created.ok(), await created.text()).toBe(true);
  const account = (await created.json()) as { id: string };
  return { email, password, accountId: account.id, accountName, openingBalance };
}

// Signs a browser context in as a given user, without touching the page's own request context.
export async function signInAs(
  context: BrowserContext,
  request: APIRequestContext,
  who: Credentials,
): Promise<void> {
  const response = await retryOnReset(() =>
    request.post("/api/auth/login", { headers: { origin: APP }, data: who }),
  );
  expect(response.ok()).toBe(true);
  await context.addCookies((await request.storageState()).cookies);
}

export async function listTransactions(request: APIRequestContext): Promise<Row[]> {
  const response = await retryOnReset(() => request.get("/api/transactions?limit=100"));
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: Row[] }).data;
}

export async function listAccounts(request: APIRequestContext): Promise<AccountRow[]> {
  const response = await retryOnReset(() =>
    request.get("/api/accounts?includeArchived=true&limit=100"),
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: AccountRow[] }).data;
}

// The e2e build is flagged as "test", so the app does not install the worker by itself: the specs
// register it to exercise what a production install would do.
export async function installWorker(page: Page): Promise<void> {
  await page.evaluate((path) => navigator.serviceWorker.register(path, { scope: "/" }), SW_PATH);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

// Reads the vault the app is using without going through it: what the queue really holds, and
// whether a snapshot ever drained, are facts a spec must not take the UI's word for.
export interface VaultState {
  name: string;
  pending: number;
  syncedAt: string | null;
  transactions: number;
}

export function vaultState(page: Page): Promise<VaultState | null> {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases())
      .map((info) => info.name ?? "")
      .find((candidate) => candidate.startsWith("lf-vault-"));
    if (!name) return null;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("open failed"));
      };
    });
    const ask = <T>(store: string, run: (source: IDBObjectStore) => IDBRequest): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const source = db.transaction(store, "readonly").objectStore(store);
        const request = run(source);
        request.onsuccess = () => {
          resolve(request.result as T);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("read failed"));
        };
      });
    const pending = await ask<number>("outbox", (store) => store.count());
    const stamp = await ask<{ value?: string } | undefined>("meta", (store) =>
      store.get("syncedAt"),
    );
    const transactions = await ask<number>("transactions", (store) => store.count());
    db.close();
    return { name, pending, syncedAt: stamp?.value ?? null, transactions };
  });
}

export interface QueuedOperation {
  seq: number;
  entity: string;
  entityId: string;
  action: string;
  status: string;
  opVersion: number;
  lastError: string | null;
}

export function outbox(page: Page): Promise<QueuedOperation[]> {
  return page.evaluate(async () => {
    const name = (await indexedDB.databases())
      .map((info) => info.name ?? "")
      .find((candidate) => candidate.startsWith("lf-vault-"));
    if (!name) return [];
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("open failed"));
      };
    });
    const rows = await new Promise<QueuedOperation[]>((resolve, reject) => {
      const request = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
      request.onsuccess = () => {
        resolve(request.result as QueuedOperation[]);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("read failed"));
      };
    });
    db.close();
    return rows.sort((left, right) => left.seq - right.seq);
  });
}

// The mirror's own copy of a row, read the same way: what the screen shows is a projection of it.
export function mirrorRow(
  page: Page,
  store: "transactions" | "accounts" | "categories",
  id: string,
): Promise<Record<string, unknown> | null> {
  return page.evaluate(
    async ([storeName, key]) => {
      const name = (await indexedDB.databases())
        .map((info) => info.name ?? "")
        .find((candidate) => candidate.startsWith("lf-vault-"));
      if (!name) return null;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("open failed"));
        };
      });
      const record = await new Promise<{ row?: Record<string, unknown> } | undefined>(
        (resolve, reject) => {
          const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
          request.onsuccess = () => {
            resolve(request.result as { row?: Record<string, unknown> } | undefined);
          };
          request.onerror = () => {
            reject(request.error ?? new Error("read failed"));
          };
        },
      );
      db.close();
      return record?.row ?? null;
    },
    [store, id] as const,
  );
}

export function addButton(page: Page) {
  return test.info().project.name === "mobile"
    ? page.getByRole("button", { name: "Add expense" })
    : page.getByRole("button", { name: "Add", exact: true });
}

export async function createExpense(
  page: Page,
  amount: number,
  description: string,
): Promise<void> {
  await page.goto(
    `/transactions/new?amount=${amount}&description=${encodeURIComponent(description)}`,
  );
  await expect(page.getByRole("heading", { level: 1, name: "New transaction" })).toBeVisible();
  await page.getByRole("button", { name: /^Category/ }).click();
  await page
    .getByRole("dialog", { name: "Category" })
    .getByRole("option", { name: /Transportation/ })
    .click();
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();
  // The screen leaves the form on its own; with no network that leave is a full page load (F-51),
  // so the row and its "Pending sync" badge on the list are what prove the save, not the toast.
  await expect(page).toHaveURL(/\/transactions(\?|$)/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: new RegExp(`${description}.*Pending sync`) }),
  ).toBeVisible();
  await page.waitForLoadState("load");
}

// Opens the app on a device that already has its vault: the page is gone, IndexedDB is not.
export async function coldStart(context: BrowserContext, at?: Date): Promise<Page> {
  const page = await context.newPage();
  if (at) await page.clock.setSystemTime(at);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  return page;
}

// The first snapshot has drained and the shell is cached: from here the device works with no network.
export async function readyForOffline(page: Page): Promise<void> {
  await installWorker(page);
  // A string, not "not null": with no vault at all `vaultState` is null, `?.syncedAt` is undefined,
  // and `not.toBeNull()` would pass in exactly the failure this gate exists to catch.
  await expect
    .poll(async () => (await vaultState(page))?.syncedAt, { timeout: 60_000 })
    .toEqual(expect.any(String));
  await expect
    .poll(
      async () =>
        page.evaluate(async () => (await caches.open("app-shell")).keys().then((k) => k.length)),
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(25);
}
