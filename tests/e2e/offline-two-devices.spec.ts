import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import {
  APP,
  type Credentials,
  freshUser,
  listAccounts,
  listTransactions,
  mirrorRow,
  outbox,
  readyForOffline,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";

// §1 examples 3, 4, 5 and 7, and §6 O-F7's second bullet: two devices of the same user, one of them
// with no network. The tablet works through its own browser, like a person on the other side.
async function device(
  browser: Parameters<Parameters<typeof test>[2]>[0]["browser"],
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
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
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
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

async function editTransaction(page: Page, id: string, fill: (page: Page) => Promise<void>) {
  await page.goto(`/transactions/${id}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Edit transaction" })).toBeVisible();
  await fill(page);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).not.toHaveURL(/\/edit$/, { timeout: 15_000 });
}

// Example 3: the tablet renames what the phone annotated. Nobody loses anything, nobody is asked.
test("compatible edits from two devices combine, with no warning", async ({
  browser,
  request,
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "compatible");
  const id = await seedTransaction(request, user.accountId, 12_345, "Taxi");

  const phone = { context, page };
  await signInAs(phone.context, request, user);
  await phone.page.goto("/home");
  await expect(phone.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(phone.page);

  await phone.context.setOffline(true);
  await phone.page.goto("/home");
  await expect(phone.page.getByText("You’re offline.")).toBeVisible();
  await editTransaction(phone.page, id, async (screen) => {
    await screen.getByRole("textbox", { name: /^Note/ }).fill("Airport run");
  });
  expect((await vaultState(phone.page))?.pending).toBe(1);

  const tablet = await device(browser, request, user);
  await editTransaction(tablet.page, id, async (screen) => {
    await screen.getByRole("textbox", { name: /^Description/ }).fill("Taxi to the airport");
  });
  await expect
    .poll(async () => (await listTransactions(request))[0]?.description, { timeout: 15_000 })
    .toBe("Taxi to the airport");

  await phone.context.setOffline(false);
  await expect
    .poll(async () => (await vaultState(phone.page))?.pending, { timeout: 90_000 })
    .toBe(0);

  const [row] = await listTransactions(request);
  expect(row).toMatchObject({ description: "Taxi to the airport", note: "Airport run" });
  // Nobody was asked: a text-only edit rebases itself onto the stamp the server answered with.
  await phone.page.goto("/home");
  await expect(phone.page.getByText("Some changes need your attention.")).toHaveCount(0);
  await tablet.context.close();
});

// Example 4: two amounts for the same movement. The app does not choose; the sheet does.
test("a money conflict is asked, and the sheet applies the answer", async ({
  browser,
  request,
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "money");
  const id = await seedTransaction(request, user.accountId, 12_345, "Groceries");

  const phone = { context, page };
  await signInAs(phone.context, request, user);
  await phone.page.goto("/home");
  await expect(phone.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(phone.page);

  await phone.context.setOffline(true);
  await phone.page.goto("/home");
  await expect(phone.page.getByText("You’re offline.")).toBeVisible();
  await editTransaction(phone.page, id, async (screen) => {
    await screen.getByRole("textbox", { name: "Amount" }).fill("30000");
  });

  const tablet = await device(browser, request, user);
  await editTransaction(tablet.page, id, async (screen) => {
    await screen.getByRole("textbox", { name: "Amount" }).fill("25000");
  });
  await expect
    .poll(async () => (await listTransactions(request))[0]?.amount, { timeout: 15_000 })
    .toBe(25_000);

  await phone.context.setOffline(false);
  // Money is never merged by the app: the operation stops and the banner says so.
  await phone.page.goto("/home");
  await expect(phone.page.getByText("Some changes need your attention.")).toBeVisible({
    timeout: 60_000,
  });
  expect((await outbox(phone.page))[0]).toMatchObject({
    status: "conflict",
    lastError: "STALE_UPDATE",
  });
  // The server still has its own figure while the question is open.
  expect((await listTransactions(request))[0]?.amount).toBe(25_000);

  await phone.page.getByRole("button", { name: "Review" }).click();
  const sheet = phone.page.getByRole("dialog", { name: "Resolve sync conflict" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { level: 3, name: "On the server" })).toBeVisible();
  await expect(sheet.getByRole("heading", { level: 3, name: "On this device" })).toBeVisible();
  expect((await new AxeBuilder({ page: phone.page }).analyze()).violations).toEqual([]);

  await sheet.getByRole("button", { name: "Keep this device’s version" }).click();
  await expect
    .poll(async () => (await vaultState(phone.page))?.pending, { timeout: 90_000 })
    .toBe(0);
  expect((await listTransactions(request))[0]?.amount).toBe(30_000);
  await tablet.context.close();
});

// Example 5, the half that merges: two categories of the same name and type are one category.
test("the same category created on both devices merges, and the phone learns the server's id", async ({
  browser,
  request,
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "category");

  const phone = { context, page };
  await signInAs(phone.context, request, user);
  await phone.page.goto("/home");
  await expect(phone.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(phone.page);

  await phone.context.setOffline(true);
  await phone.page.goto("/categories/new");
  await expect(phone.page.getByRole("heading", { level: 1, name: "New category" })).toBeVisible();
  await phone.page.getByRole("textbox", { name: "Name" }).fill("Comida");
  await phone.page.getByRole("button", { name: "Create category" }).click();
  await expect(phone.page).not.toHaveURL(/\/new$/, { timeout: 15_000 });
  const mine = (await outbox(phone.page))[0]?.entityId ?? "";
  expect(mine).not.toBe("");

  const tablet = await device(browser, request, user);
  await tablet.page.goto("/categories/new");
  await tablet.page.getByRole("textbox", { name: "Name" }).fill("comida");
  await tablet.page.getByRole("button", { name: "Create category" }).click();
  await expect(tablet.page).not.toHaveURL(/\/new$/, { timeout: 15_000 });

  await phone.context.setOffline(false);
  await expect
    .poll(async () => (await vaultState(phone.page))?.pending, { timeout: 90_000 })
    .toBe(0);

  const categories = (await (await request.get("/api/categories?limit=100")).json()) as {
    data: { id: string; name: string }[];
  };
  expect(categories.data.filter((row) => row.name.toLowerCase() === "comida")).toHaveLength(1);
  const server = categories.data.find((row) => row.name.toLowerCase() === "comida")?.id;
  expect(server).not.toBe(mine);
  // The device stopped pointing at an id the server does not have (F-57).
  expect(await mirrorRow(phone.page, "categories", mine)).toBeNull();
  expect(await mirrorRow(phone.page, "categories", server ?? "")).not.toBeNull();
  await phone.page.goto("/home");
  await expect(phone.page.getByText("Some changes need your attention.")).toHaveCount(0);
  await tablet.context.close();
});

// Example 5, the half that never merges: an account carries money, so the user is asked.
test("the same account created on both devices is asked, never merged", async ({
  browser,
  request,
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "account");

  const phone = { context, page };
  await signInAs(phone.context, request, user);
  await phone.page.goto("/home");
  await expect(phone.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(phone.page);

  await phone.context.setOffline(true);
  await phone.page.goto("/accounts/new");
  await expect(phone.page.getByRole("heading", { level: 1, name: "New account" })).toBeVisible();
  await phone.page.getByRole("textbox", { name: "Name" }).fill("Bancolombia");
  await phone.page.getByRole("button", { name: "Create account" }).click();
  await expect(phone.page).not.toHaveURL(/\/new$/, { timeout: 15_000 });

  const tablet = await device(browser, request, user);
  await tablet.page.goto("/accounts/new");
  await tablet.page.getByRole("textbox", { name: "Name" }).fill("Bancolombia");
  await tablet.page.getByRole("button", { name: "Create account" }).click();
  await expect(tablet.page).not.toHaveURL(/\/new$/, { timeout: 15_000 });

  await phone.context.setOffline(false);
  await phone.page.goto("/home");
  await expect(phone.page.getByText("Some changes need your attention.")).toBeVisible({
    timeout: 60_000,
  });
  expect((await outbox(phone.page))[0]).toMatchObject({
    entity: "account",
    status: "conflict",
    lastError: "DUPLICATE",
  });
  // Two accounts of that name would be two balances: the server has one, and it is the tablet's.
  const accounts = await listAccounts(request);
  expect(accounts.filter((row) => row.name === "Bancolombia")).toHaveLength(1);

  await phone.page.goto("/sync");
  await expect(phone.page.getByRole("heading", { level: 1 })).toHaveText(/change needs you/);
  expect((await new AxeBuilder({ page: phone.page }).analyze()).violations).toEqual([]);
  await phone.page.getByRole("button", { name: "Use the server’s version" }).click();
  // Keeping the server's version throws this device's away, and the tray asks before it does.
  const confirm = phone.page.getByRole("dialog", { name: "Discard 1 change?" });
  await confirm.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(phone.page.getByText("1 change discarded")).toBeVisible();
  await expect
    .poll(async () => (await vaultState(phone.page))?.pending, { timeout: 60_000 })
    .toBe(0);
  expect((await listAccounts(request)).filter((row) => row.name === "Bancolombia")).toHaveLength(1);
  await tablet.context.close();
});

// §1 example 7 and F-58: the account the phone spent from was archived on the tablet.
test("an account archived online offers Restore the account, and the movement goes through", async ({
  browser,
  request,
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "archived");
  // Not the user's default account: the server refuses to archive that one, and the screen's button
  // is disabled for it. This is the spare the phone will spend from.
  const created = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Wallet", type: "CASH", balance: 100_000 },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const spare = (await created.json()) as { id: string };
  const amount = uniqueAmount();

  const phone = { context, page };
  await signInAs(phone.context, request, user);
  await phone.page.goto("/home");
  await expect(phone.page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(phone.page);

  await phone.context.setOffline(true);
  await phone.page.goto(`/transactions/new?amount=${amount}&description=Bus`);
  await expect(
    phone.page.getByRole("heading", { level: 1, name: "New transaction" }),
  ).toBeVisible();
  await phone.page.getByRole("button", { name: /^Account/ }).click();
  await phone.page
    .getByRole("dialog", { name: "Account" })
    .getByRole("option", { name: /^Wallet\b/ })
    .click();
  await phone.page.getByRole("button", { name: "Save transaction" }).click();
  await expect(phone.page).toHaveURL(/\/transactions(\?|$)/, { timeout: 15_000 });

  const tablet = await device(browser, request, user);
  await tablet.page.goto(`/accounts/${spare.id}`);
  await tablet.page.getByRole("button", { name: "Archive" }).click();
  await tablet.page
    .getByRole("dialog")
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect
    .poll(
      async () => (await listAccounts(request)).find((row) => row.id === spare.id)?.archivedAt,
      {
        timeout: 15_000,
      },
    )
    .not.toBeNull();

  await phone.context.setOffline(false);
  await phone.page.goto("/sync");
  await expect(phone.page.getByRole("heading", { level: 1 })).toHaveText(/change needs you/, {
    timeout: 60_000,
  });
  await expect(phone.page.getByText("Account archived")).toBeVisible();
  await expect(
    phone.page.getByText(/uses an account that was archived on another device/),
  ).toBeVisible();
  expect((await new AxeBuilder({ page: phone.page }).analyze()).violations).toEqual([]);

  await phone.page.getByRole("button", { name: "Restore the account" }).click();
  await expect
    .poll(async () => (await vaultState(phone.page))?.pending, { timeout: 90_000 })
    .toBe(0);

  expect((await listAccounts(request)).find((row) => row.id === spare.id)?.archivedAt).toBeNull();
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(1);
  await tablet.context.close();
});
