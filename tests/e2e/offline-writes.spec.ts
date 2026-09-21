import { expect, test } from "../fixtures";
import {
  addButton,
  APP,
  coldStart,
  expectPending,
  freshUser,
  listAccounts,
  listTransactions,
  readyForOffline,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";

const HOW_MANY = 20;

// §6 O-F7, first bullet: each test registers its own user, so the counts are its alone.
test("twenty movements with no network survive a reload and reach the server exactly once", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(300_000);
  // F-63: euros in Madrid — a user born with the app's own fallbacks could not tell the two apart.
  const user = await freshUser(request, "writes", { currency: "EUR", timezone: "Europe/Madrid" });
  const amounts = new Set<number>();
  while (amounts.size < HOW_MANY) amounts.add(uniqueAmount());
  const wanted = [...amounts];

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  expect(await listTransactions(request)).toEqual([]);

  await context.setOffline(true);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();

  // Twenty captures and nothing else: a note would be a second operation of its own.
  for (const amount of wanted) {
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add" });
    await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
    await page.keyboard.type(String(amount));
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toBeHidden();
  }

  await expect(page.getByText(new RegExp(`${HOW_MANY} changes waiting`))).toBeVisible();
  await expectPending(page, HOW_MANY);
  // Not one of them left the device.
  expect(await listTransactions(request)).toEqual([]);

  // A reload with no network: the queue belongs to IndexedDB, not to the tab (invariant 7).
  await page.reload();
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expectPending(page, HOW_MANY);

  // And a cold start, which is the device the next morning: the page is gone, the vault is not.
  await page.close();
  const back = await coldStart(context);
  await expect(back.getByText(new RegExp(`${HOW_MANY} changes waiting`))).toBeVisible();
  expect((await vaultState(back))?.pending).toBe(HOW_MANY);
  await back.goto("/transactions");
  await expect(back.getByRole("button", { name: /Pending sync/ })).toHaveCount(HOW_MANY);
  // F-63: euros and the user's name, all read from the mirror's profile.
  await expect(back.getByText(/€/).first()).toBeVisible();
  await expect(back.getByText(/COP/)).toHaveCount(0);
  if (test.info().project.name === "desktop")
    await expect(back.getByRole("link", { name: /Offline writes/ })).toBeVisible();

  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(back))?.pending, { timeout: 90_000 }).toBe(0);

  const after = await listTransactions(request);
  expect(after).toHaveLength(HOW_MANY);
  for (const amount of wanted) {
    expect(
      after.filter((row) => row.amount === amount),
      String(amount),
    ).toHaveLength(1);
  }

  // And the money moved by exactly what the twenty expenses take out, not a cent more.
  const [account] = await listAccounts(request);
  const spent = wanted.reduce((sum, amount) => sum + amount, 0);
  expect(account?.balance).toBe(user.openingBalance - spent);

  // The screen agrees: nothing is waiting, and no row is marked as this device's own any more.
  await back.goto("/transactions");
  await expect(back.getByRole("button", { name: /Pending sync/ })).toHaveCount(0);
  await expect(back.getByText(/changes? waiting/)).toHaveCount(0);
});

// §1 example 2: `POST /sync` remembers the opIds (D-2), so a replay lands nothing twice.
test("a reply lost after the server applied it replays as a duplicate, not as a second row", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "lost-reply");
  const amount = uniqueAmount();

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expectPending(page, 1);

  // Counted and read, not assumed: only the second answer saying `duplicate` proves the title.
  const answers: string[][] = [];
  await context.route("**/api/sync", async (route) => {
    const answered = await route.fetch();
    const text = await answered.text();
    const body = JSON.parse(text) as { results?: { status: string }[] };
    answers.push((body.results ?? []).map((result) => result.status));
    if (answers.length === 1) return route.abort("connectionfailed");
    await route.fulfill({ response: answered, body: text });
  });

  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  expect(answers).toEqual([["applied"], ["duplicate"]]);

  const after = await listTransactions(request);
  expect(after).toHaveLength(1);
  expect(after[0]?.amount).toBe(amount);
  const [account] = await listAccounts(request);
  expect(account?.balance).toBe(user.openingBalance - amount);
});

// T-123: the one write whose movements the server mints, so the device mints its own and drops them.
test("a settle-up with no network moves every figure, and the server's movement replaces the device's", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(300_000);
  const user = await freshUser(request, "settle");
  await signInAs(context, request, user);

  const [account] = await listAccounts(request);
  const categories = await request.get("/api/categories?type=EXPENSE&limit=1");
  const spent = 100_000;
  const expense = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "EXPENSE",
      amount: spent,
      date: "2026-09-20T20:00:00.000Z",
      description: "Dinner",
      fromAccountId: account?.id,
      categoryId: ((await categories.json()) as { data: { id: string }[] }).data[0]?.id,
    },
  });
  const created = (await expense.json()) as { id: string };
  const person = await request.post("/api/contacts", {
    headers: { origin: APP },
    data: { name: "Beto Cano", color: "BLUE" },
  });
  const contact = (await person.json()) as { id: string };
  const group = await request.post("/api/shared-groups", {
    headers: { origin: APP },
    data: { name: "Night out", contactIds: [contact.id] },
  });
  const outing = (await group.json()) as { id: string };
  const line = await request.post(`/api/shared-groups/${outing.id}/expenses`, {
    headers: { origin: APP },
    data: { transactionId: created.id },
  });
  expect(line.ok()).toBe(true);

  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);
  // A group's page is a nested template the worker only caches once it has been opened (T-01).
  await page.goto(`/shared/groups/${outing.id}`);
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Night out" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Settle up" }).click();
  const sheet = page.getByRole("dialog", { name: "Settle up with Beto Cano" });
  await sheet.getByRole("button", { name: /Where it arrives/ }).click();
  await page.getByRole("option").first().click();
  await sheet.getByRole("button", { name: "Record payment" }).click();
  await expect(sheet).toBeHidden();

  // Nothing left the device, and every figure moved all the same.
  expect((await vaultState(page))?.pending).toBe(1);
  await expect(page.getByText("Paid in full")).toBeVisible();
  await page.goto("/transactions");
  await expect(page.getByText("Your share $50,000")).toBeVisible();
  // The payment the device minted is in the list, neutral and with its person's name.
  await expect(page.getByText("Payment").first()).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByText(/4,950,000/).first()).toBeVisible();

  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);

  // Exactly one payment reached the server, and the device's own copy of it is gone.
  const settlements = await request.get("/api/settlements?limit=100");
  expect(((await settlements.json()) as { data: unknown[] }).data).toHaveLength(1);
  const rows = await listTransactions(request);
  expect(rows.filter((row) => row.type === "SETTLEMENT")).toHaveLength(1);
  const [reread] = await listAccounts(request);
  expect(reread?.balance).toBe(user.openingBalance - spent + 50_000);
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /Pending sync/ })).toHaveCount(0);
  await expect(page.getByText("Payment")).toHaveCount(1);
});
