import { mkdirSync, writeFileSync } from "node:fs";

import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
const DAY_MS = 86_400_000;

type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

interface Row {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  categoryId: string | null;
  pendingDetails: boolean;
}

interface Call {
  method: string;
  path: string;
}

// Every /api call the pages make, in order, so a phase can be measured by slicing the log (§4.2).
class Tally {
  readonly calls: Call[] = [];

  watch(page: Page): void {
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith("/api/")) {
        this.calls.push({ method: request.method(), path: pathname });
      }
    });
  }

  mark(): number {
    return this.calls.length;
  }

  since(mark: number): Call[] {
    return this.calls.slice(mark);
  }
}

const DATA = /^\/api\/(accounts|categories|transactions|budgets|stats|users)/;
const reads = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method === "GET" && DATA.test(c.path));
const pushes = (calls: Call[]): Call[] =>
  calls.filter((c) => c.method !== "GET" && DATA.test(c.path));
const pulls = (calls: Call[]): Call[] => calls.filter((c) => c.path === "/api/sync/changes");
const health = (calls: Call[]): Call[] => calls.filter((c) => c.path.startsWith("/api/health"));

function uniqueAmount(): number {
  return 100_000 + Math.floor(Math.random() * 899_999);
}

async function signIn(page: Page, request: Request): Promise<void> {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

async function listTransactions(request: Request): Promise<Row[]> {
  const response = await request.get("/api/transactions?limit=100");
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: Row[] }).data;
}

// The e2e build is flagged as "test", so the app does not install the worker by itself.
async function installWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

async function warmedRoutes(page: Page, cacheName: string): Promise<number> {
  return page.evaluate(async (name) => {
    const cache = await caches.open(name);
    return (await cache.keys()).length;
  }, cacheName);
}

interface VaultState {
  name: string;
  pending: number;
  syncedAt: string | null;
  transactions: number;
}

// Reads the vault the app is using without going through it: what the queue really holds, and
// whether a snapshot ever drained, are the two facts the demo cannot take the UI's word for.
async function vaultState(page: Page): Promise<VaultState | null> {
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

async function mirrorIdByAmount(page: Page, amount: number): Promise<string | null> {
  return page.evaluate(async (target) => {
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
    const rows = await new Promise<{ id: string; row: { amount: number } }[]>((resolve, reject) => {
      const request = db
        .transaction("transactions", "readonly")
        .objectStore("transactions")
        .getAll();
      request.onsuccess = () => {
        resolve(request.result as { id: string; row: { amount: number } }[]);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("read failed"));
      };
    });
    db.close();
    return rows.find((record) => record.row.amount === target)?.id ?? null;
  }, amount);
}

function addButton(page: Page) {
  return test.info().project.name === "mobile"
    ? page.getByRole("button", { name: "Add expense" })
    : page.getByRole("button", { name: "Add", exact: true });
}

async function createExpense(page: Page, amount: number, description: string): Promise<void> {
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
  await expect(page.getByText("Transaction saved")).toBeVisible();
  // The screen leaves the form on its own; a goto fired into that navigation is aborted.
  await expect(page).not.toHaveURL(/\/transactions\/new/);
  await page.waitForLoadState("load");
}

// A day of the outage: the page the device had is gone, the browser starts the app again from the
// worker's caches, and the only thing that carries over is what IndexedDB kept.
async function coldStart(context: BrowserContext, tally: Tally, at: Date): Promise<Page> {
  const page = await context.newPage();
  tally.watch(page);
  await page.clock.setSystemTime(at);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  return page;
}

test("three days with no network, a cold start each day, and one drain with no duplicates", async ({
  page,
  request,
}) => {
  const tally = new Tally();
  tally.watch(page);
  const context = page.context();
  const report: Record<string, unknown> = { project: test.info().project.name };
  const now = Date.now();
  // The outage is the three days before today, so every movement it queues is dated in the past:
  // the server refuses a date more than 24 h ahead of its own clock (FUTURE_DATE).
  const days = [new Date(now - 3 * DAY_MS), new Date(now - 2 * DAY_MS), new Date(now - DAY_MS)];
  // Declared here and filled in by the steps: the whole point of the demo is that what one day
  // leaves behind is still there on the next one.
  let editRow: Row;
  let deleteRow: Row;
  let before = 0;
  let amountA = 0;
  let amountQ = 0;
  let quickId = "";
  let createdId = "";
  let queued = 0;
  let after: Row[] = [];

  await test.step("Día 0 · con red: se llena el mirror y se calienta el shell", async () => {
    await signIn(page, request);
    await page.clock.setSystemTime(days[0]!);
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await installWorker(page);
    await page.clock.setSystemTime(days[0]!);
    for (const cacheName of ["app-shell", "app-shell-rsc"]) {
      await expect
        .poll(async () => warmedRoutes(page, cacheName), { timeout: 60_000 })
        .toBeGreaterThanOrEqual(9);
    }
    await expect
      .poll(async () => (await vaultState(page))?.syncedAt, { timeout: 60_000 })
      .not.toBeNull();
    report.mirrorAfterFirstLoad = await vaultState(page);

    const seeded = await listTransactions(request);
    const editable = seeded.filter(
      (row) => row.type === "EXPENSE" && row.description && !row.pendingDetails,
    );
    editRow = editable[0]!;
    deleteRow = editable[1]!;
    expect(editRow.id).not.toBe(deleteRow.id);
    before = seeded.length;
    // Detail routes are not in the warmed shell (lib/pwa/shell.ts): they arrive with what the user
    // visits, so the two rows the outage is going to touch are visited now, with network.
    for (const path of [
      // Not a detail route: `/transactions/review` is simply missing from SHELL_PATHS, so the inbox
      // every quick capture lands in is not reachable with no network unless it was opened before.
      "/transactions/review",
      `/transactions/${editRow.id}`,
      `/transactions/${editRow.id}/edit`,
      `/transactions/${deleteRow.id}`,
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
  });

  await test.step("Se corta la red", async () => {
    await context.setOffline(true);
    await page.goto("/home");
    await expect(page.getByText("You’re offline.")).toBeVisible();
  });

  await test.step("Día 1 · dos movimientos sin red, uno de ellos una captura rápida", async () => {
    amountA = uniqueAmount();
    amountQ = uniqueAmount();
    const mark = tally.mark();
    await createExpense(page, amountA, "GATE-D1 market");
    await page.goto("/home");
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add expense" });
    await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
    await page.keyboard.type(String(amountQ));
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Transaction saved")).toBeVisible();
    report.day1 = {
      reads: reads(tally.since(mark)).length,
      pushes: pushes(tally.since(mark)).length,
      pulls: pulls(tally.since(mark)).length,
      health: health(tally.since(mark)).length,
    };
    expect(reads(tally.since(mark))).toHaveLength(0);
    expect(pushes(tally.since(mark))).toHaveLength(0);

    await page.goto("/transactions");
    await expect(page.getByRole("button", { name: /GATE-D1 market.*Pending sync/ })).toBeVisible();
    await expect(page.getByText(/2 changes waiting/)).toBeVisible();
    expect((await vaultState(page))?.pending).toBe(2);

    quickId = (await mirrorIdByAmount(page, amountQ)) ?? "";
    createdId = (await mirrorIdByAmount(page, amountA)) ?? "";
    expect(quickId).not.toBe("");
    expect(createdId).not.toBe("");
    await page.close();
  });

  await test.step("Día 2 · arranque en frío, y sin red: editar, borrar, crear, cambiar de mes y de filtro", async () => {
    const day2 = await coldStart(context, tally, days[1]!);
    await expect(day2.getByText(/2 changes waiting/)).toBeVisible();
    expect((await vaultState(day2))?.pending).toBe(2);

    const mark = tally.mark();
    await day2.goto(`/transactions/${editRow.id}/edit`);
    await expect(day2.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible();
    await day2.getByRole("textbox", { name: /^Description/ }).fill("GATE-EDIT offline");
    await day2.getByRole("button", { name: "Save changes" }).click();
    await expect(day2.getByText("Changes saved")).toBeVisible();
    await expect(day2).not.toHaveURL(/\/edit$/);
    await day2.waitForLoadState("load");

    await day2.goto(`/transactions/${deleteRow.id}`);
    await day2.getByRole("button", { name: "Delete" }).click();
    await day2
      .getByRole("dialog", { name: "Delete this transaction?" })
      .getByRole("button", { name: "Delete" })
      .click();
    // The screen leaves for the list as soon as the queue has the removal, too fast for a toast.
    await day2.waitForURL(/\/transactions$/, { timeout: 30_000 });
    await expect(day2.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();

    await createExpense(day2, uniqueAmount(), "GATE-D2 pharmacy");

    const beforeMonth = tally.mark();
    await day2.goto("/budgets");
    await expect(day2.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();
    const beforeClick = tally.mark();
    await day2.getByRole("button", { name: "Previous month" }).click();
    await expect(day2).toHaveURL(/reference=\d{4}-\d{2}/);
    await expect(day2.getByRole("button", { name: "Next month" })).toBeEnabled();
    const monthCalls = tally.since(beforeClick);

    await day2.goto("/transactions");
    await expect(day2.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
    const beforeFilter = tally.mark();
    await day2.getByRole("button", { name: "Expenses" }).click();
    await expect(day2).toHaveURL(/type=EXPENSE/);
    await expect(day2.getByRole("button", { name: "Expenses", pressed: true })).toBeVisible();
    const filterCalls = tally.since(beforeFilter);

    const day2Reads = reads(tally.since(mark)).map((call) => call.path);
    report.day2 = {
      reads: day2Reads,
      pushes: pushes(tally.since(mark)).length,
      openBudgets: reads(tally.since(beforeMonth)).length,
      changeMonth: reads(monthCalls).length,
      changeFilter: reads(filterCalls).length,
    };
    // The one read the mirror does not answer with no network: a deleted row leaves a tombstone the
    // repository refuses to read, so the detail query falls through to a server that is not there.
    expect(day2Reads).toEqual([`/api/transactions/${deleteRow.id}`]);
    expect(pushes(tally.since(mark))).toHaveLength(0);
    expect((await vaultState(day2))?.pending).toBe(5);
    await day2.close();
  });

  await test.step("Día 3 · arranque en frío, un movimiento más y la captura completada en «To review»", async () => {
    const day3 = await coldStart(context, tally, days[2]!);
    await expect(day3.getByText(/5 changes waiting/)).toBeVisible();

    const mark = tally.mark();
    await createExpense(day3, uniqueAmount(), "GATE-D3 taxi");

    await day3.goto(`/transactions/review?focus=${quickId}`);
    const card = day3.locator(`[data-transaction-id="${quickId}"]`);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Coffee" }).click();
    await card.getByRole("textbox", { name: "Description" }).fill("GATE-REVIEW latte");
    await card.getByRole("button", { name: "Done" }).click();
    await expect(day3.getByText("Details saved")).toBeVisible();
    await day3.waitForLoadState("load");
    expect(reads(tally.since(mark))).toHaveLength(0);
    expect(pushes(tally.since(mark))).toHaveLength(0);

    // What a movement created during the outage can be opened with: its detail route was never
    // cached, so this records what the app answers rather than asserting today's answer (F-48).
    await day3.goto(`/transactions/${createdId}`);
    report.detailOfAnOfflineRow = await day3
      .getByRole("heading", { level: 1 })
      .first()
      .textContent();

    queued = (await vaultState(day3))?.pending ?? -1;
    report.queuedBeforeDrain = queued;
    await day3.close();
  });

  await test.step("Vuelve la red · la cola se drena, y a un POST se le tira la respuesta a propósito", async () => {
    const day4 = await coldStart(context, tally, new Date(now));
    expect((await vaultState(day4))?.pending).toBe(queued);

    // The duplicate the gate is about: the server applies a create and the answer never arrives, so
    // the queue retries an operation that already exists on the other side.
    let dropped: string | null = null;
    await day4.route("**/api/transactions", async (route) => {
      if (dropped !== null || route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      dropped = route.request().postData();
      await route.fetch();
      await route.abort("connectionfailed");
    });

    const beforeDrain = tally.mark();
    await context.setOffline(false);
    await expect.poll(async () => (await vaultState(day4))?.pending, { timeout: 120_000 }).toBe(0);
    const drain = tally.since(beforeDrain);
    report.drain = {
      pushes: pushes(drain).length,
      pulls: pulls(drain).length,
      reads: reads(drain).length,
      droppedAnswer: dropped !== null,
      byRoute: pushes(drain).map((call) => `${call.method} ${call.path}`),
    };
    expect(dropped).not.toBeNull();
  });

  await test.step("Contra el API real · cero duplicados", async () => {
    after = await listTransactions(request);
    const named = (needle: string): Row[] =>
      after.filter((row) => (row.description ?? "").includes(needle));
    expect(named("GATE-D1 market")).toHaveLength(1);
    expect(named("GATE-D2 pharmacy")).toHaveLength(1);
    expect(named("GATE-D3 taxi")).toHaveLength(1);
    expect(named("GATE-REVIEW latte")).toHaveLength(1);
    expect(named("GATE-EDIT offline")).toHaveLength(1);
    expect(after.filter((row) => row.amount === amountA)).toHaveLength(1);
    expect(after.filter((row) => row.amount === amountQ)).toHaveLength(1);
    expect(named("GATE-REVIEW latte")[0]).toMatchObject({ pendingDetails: false });
    expect(named("GATE-REVIEW latte")[0]?.categoryId).toBeTruthy();
    expect((await request.get(`/api/transactions/${deleteRow.id}`)).status()).toBe(404);
    expect(after).toHaveLength(before + 4 - 1);
    report.server = { before, after: after.length };
  });

  await test.step("Un arranque en frío más, con red · el mirror y el servidor dicen lo mismo", async () => {
    const settled = await coldStart(context, tally, new Date(now));
    await settled.goto("/transactions");
    await expect(settled.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
    await expect(settled.getByRole("button", { name: /GATE-D3 taxi/ })).toHaveCount(1);
    await expect(settled.getByRole("button", { name: /Pending sync/ })).toHaveCount(0);
    await expect(settled.getByText(/changes waiting/)).toHaveCount(0);
    expect((await vaultState(settled))?.pending).toBe(0);
  });

  await test.step("Limpieza · el recorrido se lleva lo que trajo", async () => {
    for (const row of after.filter((candidate) =>
      (candidate.description ?? "").startsWith("GATE-D"),
    )) {
      await request.delete(`/api/transactions/${row.id}`, { headers: { origin: APP } });
    }
    for (const row of after.filter((candidate) =>
      (candidate.description ?? "").startsWith("GATE-REVIEW"),
    )) {
      await request.delete(`/api/transactions/${row.id}`, { headers: { origin: APP } });
    }
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      `test-results/offline-gate-${test.info().project.name}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    );
  });
});
