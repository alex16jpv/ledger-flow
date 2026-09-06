import { mkdirSync, writeFileSync } from "node:fs";

import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

import {
  APP,
  type Credentials,
  freshUser,
  listAccounts,
  listTransactions,
  mirrorRow,
  outbox,
  type QueuedOperation,
  readyForOffline,
  signInAs,
  vaultState,
} from "../offline";
import { batches, pulls, pushes, reads, Tally } from "./tally";

type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

interface Category {
  id: string;
  name: string;
  type: string;
}

// The other device of the same user: its own browser context, with network the whole time, like a
// person working on the tablet while the phone is in the metro.
async function otherDevice(
  browser: Browser,
  request: Request,
  who: Credentials,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: APP });
  await signInAs(context, request, who);
  const page = await context.newPage();
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  return { context, page };
}

async function seedTransaction(
  request: Request,
  accountId: string,
  amount: number,
  description: string,
): Promise<string> {
  const created = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "EXPENSE",
      amount,
      fromAccountId: accountId,
      description,
      date: new Date().toISOString(),
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  return ((await created.json()) as { id: string }).id;
}

async function listCategories(request: Request): Promise<Category[]> {
  const response = await request.get("/api/categories?limit=100");
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: Category[] }).data;
}

async function editTransaction(
  page: Page,
  id: string,
  fill: (screen: Page) => Promise<void>,
): Promise<void> {
  await page.goto(`/transactions/${id}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible();
  await fill(page);
  await page.getByRole("button", { name: "Save changes" }).click();
  // Offline the leave is a full page load (F-51), so the list, not a toast, is what proves the save.
  await expect(page).not.toHaveURL(/\/edit$/, { timeout: 15_000 });
  await page.waitForLoadState("load");
}

async function createExpenseOn(
  page: Page,
  amount: number,
  description: string,
  account: RegExp,
  category?: RegExp,
): Promise<void> {
  await page.goto(
    `/transactions/new?amount=${amount}&description=${encodeURIComponent(description)}`,
  );
  await expect(page.getByRole("heading", { level: 1, name: "New transaction" })).toBeVisible();
  if (category) {
    await page.getByRole("button", { name: /^Category/ }).click();
    await page
      .getByRole("dialog", { name: "Category" })
      .getByRole("option", { name: category })
      .click();
  }
  await page.getByRole("button", { name: /^Account/ }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("option", { name: account })
    .click();
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page).toHaveURL(/\/transactions(\?|$)/, { timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: new RegExp(`${description}.*Pending sync`) }),
  ).toBeVisible();
  await page.waitForLoadState("load");
}

async function createCategory(page: Page, name: string): Promise<void> {
  await page.goto("/categories/new");
  await expect(page.getByRole("heading", { level: 1, name: "New category" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page).not.toHaveURL(/\/new$/, { timeout: 15_000 });
  await page.waitForLoadState("load");
}

const statuses = (queue: QueuedOperation[]): string[] => queue.map((operation) => operation.status);

test("two devices, one outage: what merges merges, what is money is asked, and one batch per pass", async ({
  browser,
  page,
  context,
  request,
}) => {
  test.setTimeout(15 * 60_000);
  const tally = new Tally();
  tally.watch(page);
  const report: Record<string, unknown> = { project: test.info().project.name };
  // Euros in Madrid, and a user of its own: the seeded one is shared by the whole suite, and what
  // this demo counts — rows, balances, one merged category — is a race on a shared user. The
  // currency also makes F-63 visible: with no session the shell has to read it from the mirror.
  const user = await freshUser(request, "gate-b", {
    currency: "EUR",
    timezone: "Europe/Madrid",
    openingBalance: 1_200,
  });
  const created = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Wallet", type: "CASH", balance: 100 },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const spare = (await created.json()) as { id: string };
  const spareBalance = 100;

  // Euros a person would really spend: the demo is watched, and four amounts that cannot collide
  // are enough for a user whose whole history is these four rows.
  const noted = 24;
  const disputed = 20;
  const corrected = 30;
  const fromTheTablet = 25;
  const busAmount = 2;
  const lunchAmount = 13;
  let notedId = "";
  let disputedId = "";
  let phoneCategoryId = "";
  let serverCategoryId = "";
  let queued = 0;
  const answers: string[][] = [];

  await test.step("Día 0 · con red: el teléfono se prepara y la tablet mira lo mismo", async () => {
    notedId = await seedTransaction(request, user.accountId, noted, "Taxi");
    disputedId = await seedTransaction(request, user.accountId, disputed, "Groceries");
    await signInAs(context, request, user);
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await readyForOffline(page);
    report.mirrorAfterFirstLoad = await vaultState(page);
  });

  await test.step("Se corta la red del teléfono", async () => {
    await context.setOffline(true);
    await page.goto("/home");
    await expect(page.getByText("You’re offline.")).toBeVisible();
    // Whose device this is comes from the mirror's profile, not from the app's fallbacks (F-63).
    await expect(page.getByText(/€/).first()).toBeVisible();
    await expect(page.getByText(/COP/)).toHaveCount(0);
  });

  await test.step("El teléfono, sin red · una nota, un importe, una categoría y dos movimientos", async () => {
    const mark = tally.mark();
    await editTransaction(page, notedId, async (screen) => {
      await screen.getByRole("textbox", { name: /^Note/ }).fill("Airport run");
    });
    await editTransaction(page, disputedId, async (screen) => {
      await screen.getByRole("textbox", { name: "Amount" }).fill(String(corrected));
    });
    await createCategory(page, "Comida");
    phoneCategoryId =
      (await outbox(page)).find((operation) => operation.entity === "category")?.entityId ?? "";
    expect(phoneCategoryId).not.toBe("");
    // The account this one spends from is the one the tablet is about to archive (example 7).
    await createExpenseOn(page, busAmount, "GATE-B bus", /^Wallet\b/);
    // And this one names the category that only exists on this device (example 5).
    await createExpenseOn(page, lunchAmount, "GATE-B lunch", /^Cash\b/, /^Comida\b/);

    const offline = tally.since(mark);
    report.outage = {
      reads: reads(offline).length,
      pushes: pushes(offline).length,
      batches: batches(offline).length,
    };
    expect(reads(offline)).toEqual([]);
    expect(pushes(offline)).toHaveLength(0);
    expect(batches(offline)).toHaveLength(0);
    await expect(page.getByText(/5 changes waiting/)).toBeVisible();
    queued = (await vaultState(page))?.pending ?? -1;
    expect(queued).toBe(5);
    report.queuedBeforeDrain = queued;
    // Nothing left the device: the server still has the two rows it started with.
    expect(await listTransactions(request)).toHaveLength(2);
  });

  const tablet = await otherDevice(browser, request, user);

  await test.step("La tablet, con red · renombra, corrige el importe, crea la misma categoría y archiva la cuenta", async () => {
    await editTransaction(tablet.page, notedId, async (screen) => {
      await screen.getByRole("textbox", { name: /^Description/ }).fill("Taxi to the airport");
    });
    await editTransaction(tablet.page, disputedId, async (screen) => {
      await screen.getByRole("textbox", { name: "Amount" }).fill(String(fromTheTablet));
    });
    await createCategory(tablet.page, "comida");
    await tablet.page.goto(`/accounts/${spare.id}`);
    await tablet.page.getByRole("button", { name: "Archive" }).click();
    await tablet.page
      .getByRole("dialog")
      .getByRole("button", { name: "Archive", exact: true })
      .click();

    const rows = await listTransactions(request);
    expect(rows.find((row) => row.id === notedId)?.description).toBe("Taxi to the airport");
    expect(rows.find((row) => row.id === disputedId)?.amount).toBe(fromTheTablet);
    serverCategoryId =
      (await listCategories(request)).find((row) => row.name.toLowerCase() === "comida")?.id ?? "";
    expect(serverCategoryId).not.toBe("");
    expect(serverCategoryId).not.toBe(phoneCategoryId);
    await expect
      .poll(
        async () => (await listAccounts(request)).find((row) => row.id === spare.id)?.archivedAt,
        { timeout: 15_000 },
      )
      .not.toBeNull();
  });

  await test.step("Vuelve la red · un POST /sync por pasada, y la respuesta del primer lote se tira", async () => {
    // Example 2, on the batch: the server applies the whole queue and the answer never arrives, so
    // the phone replays it. What proves nothing landed twice is the second answer, read here.
    await context.route("**/api/sync", async (route) => {
      const answered = await route.fetch();
      const text = await answered.text();
      const body = JSON.parse(text) as { results?: { status: string }[] };
      answers.push((body.results ?? []).map((result) => result.status));
      if (answers.length === 1) return route.abort("connectionfailed");
      await route.fulfill({ response: answered, body: text });
    });

    const mark = tally.mark();
    await context.setOffline(false);
    // The queue settles with exactly the two questions the user has to answer: the money and the
    // archived account. Everything else merged, landed or replayed by itself.
    await expect
      .poll(async () => statuses(await outbox(page)).sort(), { timeout: 240_000 })
      .toEqual(["conflict", "conflict"]);

    const drain = tally.since(mark);
    report.drain = {
      batches: batches(drain).length,
      operationsPerBatch: batches(drain).map((call) => call.operations ?? 0),
      pushes: pushes(drain).length,
      pulls: pulls(drain).length,
      reads: reads(drain).map((call) => `${call.path}${call.search}`),
      answers: [...answers],
    };
    // One request per pass, never one per operation, and the first one carries the whole queue.
    expect(batches(drain).length).toBeGreaterThanOrEqual(2);
    expect(batches(drain)[0]?.operations).toBe(queued);
    expect(batches(drain).every((call) => (call.operations ?? 0) >= 1)).toBe(true);
    // Not one operation went by the ordinary routes, and coming back online read nothing (§4.2).
    expect(pushes(drain)).toHaveLength(0);
    expect(reads(drain)).toEqual([]);
    // The replay is answered, not applied again: what landed the first time comes back `duplicate`.
    expect(answers[0]).toEqual(["conflict", "conflict", "merged", "conflict", "applied"]);
    expect(answers[1]).toEqual(["conflict", "conflict", "duplicate", "conflict", "duplicate"]);
  });

  await test.step("Ejemplo 3 · la nota y el nombre nuevo se combinan sin preguntar", async () => {
    const row = (await listTransactions(request)).find((candidate) => candidate.id === notedId);
    expect(row).toMatchObject({ description: "Taxi to the airport", note: "Airport run" });
    report.compatibleEdit = { description: row?.description, note: row?.note };
  });

  await test.step("Ejemplo 5 · la categoría se fusionó y el teléfono repuntó su id", async () => {
    const comida = (await listCategories(request)).filter(
      (row) => row.name.toLowerCase() === "comida",
    );
    expect(comida).toHaveLength(1);
    expect(comida[0]?.id).toBe(serverCategoryId);
    // The device stopped pointing at an id the server does not have (F-57).
    expect(await mirrorRow(page, "categories", phoneCategoryId)).toBeNull();
    expect(await mirrorRow(page, "categories", serverCategoryId)).not.toBeNull();
    // And the movement queued behind it landed on the server's category, not on the phone's id.
    const lunch = (await listTransactions(request)).find((row) => row.amount === lunchAmount);
    expect(lunch?.categoryId).toBe(serverCategoryId);
    report.mergedCategory = { phone: phoneCategoryId, server: serverCategoryId };
  });

  await test.step("Ejemplo 4 · el conflicto de dinero se pregunta, y el usuario se queda con el suyo", async () => {
    await page.goto("/home");
    await expect(page.getByText("Some changes need your attention.")).toBeVisible({
      timeout: 60_000,
    });
    // While the question is open the server keeps its own figure: nothing was chosen for the user.
    expect((await listTransactions(request)).find((row) => row.id === disputedId)?.amount).toBe(
      fromTheTablet,
    );

    await page.getByRole("button", { name: "Review" }).click();
    const sheet = page.getByRole("dialog", { name: "Resolve sync conflict" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { level: 3, name: "On the server" })).toBeVisible();
    await expect(sheet.getByRole("heading", { level: 3, name: "On this device" })).toBeVisible();
    await sheet.getByRole("button", { name: "Keep this device’s version" }).click();

    await expect
      .poll(async () => statuses(await outbox(page)).sort(), { timeout: 180_000 })
      .toEqual(["conflict"]);
    const row = (await listTransactions(request)).find((candidate) => candidate.id === disputedId);
    expect(row?.amount).toBe(corrected);
    report.moneyConflict = { server: fromTheTablet, device: corrected, kept: row?.amount };
  });

  await test.step("Ejemplo 7 · la bandeja ofrece «Restore the account» y el movimiento pasa", async () => {
    await page.goto("/sync");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/change needs you/);
    await expect(page.getByText("Account archived")).toBeVisible();
    await page.getByRole("button", { name: "Restore the account" }).click();
    await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 180_000 }).toBe(0);

    const wallet = (await listAccounts(request)).find((row) => row.id === spare.id);
    expect(wallet?.archivedAt).toBeNull();
    expect(
      (await listTransactions(request)).filter((row) => row.amount === busAmount),
    ).toHaveLength(1);
    report.restoredAccount = { id: spare.id, archivedAt: wallet?.archivedAt };
  });

  await test.step("Contra el API real · las filas, los saldos y el total de peticiones", async () => {
    const rows = await listTransactions(request);
    expect(rows).toHaveLength(4);
    for (const description of ["Taxi to the airport", "Groceries", "GATE-B bus", "GATE-B lunch"]) {
      expect(
        rows.filter((row) => (row.description ?? "") === description),
        description,
      ).toHaveLength(1);
    }
    const accounts = await listAccounts(request);
    const cash = accounts.find((row) => row.id === user.accountId);
    const wallet = accounts.find((row) => row.id === spare.id);
    // Every euro the outage moved, and not one more: the money conflict counts once, at 30.
    expect(cash?.balance).toBe(user.openingBalance - noted - corrected - lunchAmount);
    expect(wallet?.balance).toBe(spareBalance - busAmount);
    report.server = {
      transactions: rows.length,
      cash: cash?.balance,
      wallet: wallet?.balance,
      batches: batches(tally.calls).length,
      operationsPerBatch: batches(tally.calls).map((call) => call.operations ?? 0),
      pushesByOrdinaryRoutes: pushes(tally.calls).length,
    };
    expect(pushes(tally.calls)).toHaveLength(0);
  });

  await test.step("Un arranque en frío más, con red · el mirror y el servidor dicen lo mismo", async () => {
    await page.close();
    const settled = await context.newPage();
    tally.watch(settled);
    await settled.goto("/transactions");
    await expect(settled.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
    await expect(settled.getByRole("button", { name: /Taxi to the airport/ })).toHaveCount(1);
    await expect(settled.getByRole("button", { name: /GATE-B bus/ })).toHaveCount(1);
    await expect(settled.getByRole("button", { name: /Pending sync/ })).toHaveCount(0);
    await expect(settled.getByText(/changes? waiting/)).toHaveCount(0);
    await expect(settled.getByText("Some changes need your attention.")).toHaveCount(0);
    expect((await vaultState(settled))?.pending).toBe(0);
  });

  await test.step("El informe · lo que la corrida midió", () => {
    mkdirSync("test-results", { recursive: true });
    writeFileSync(
      `test-results/offline-gate-b-${test.info().project.name}.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    );
  });

  await tablet.context.close();
});
