import { expect, test } from "@playwright/test";

import {
  addButton,
  coldStart,
  freshUser,
  listAccounts,
  listTransactions,
  readyForOffline,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";

const HOW_MANY = 20;

// §6 O-F7, first bullet: twenty movements with no network, a reload with no network, a reconnection,
// and no duplicates or figures moved. Each test registers its own user, so the counts and the
// balances are this test's alone (nothing to clean up either — the user is thrown away).
test("twenty movements with no network survive a reload and reach the server exactly once", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(300_000);
  // Euros in Madrid, not the defaults: what the shell shows with no session has to come from the
  // mirror's profile, and a user born with the app's own fallbacks could not tell the two apart (F-63).
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

  // Twenty captures and nothing else: a note would be a second operation of its own, and what is
  // being counted here is movements.
  for (const amount of wanted) {
    await addButton(page).click();
    const sheet = page.getByRole("dialog", { name: "Add expense" });
    await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
    await page.keyboard.type(String(amount));
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(sheet).toBeHidden();
  }

  await expect(page.getByText(new RegExp(`${HOW_MANY} changes waiting`))).toBeVisible();
  expect((await vaultState(page))?.pending).toBe(HOW_MANY);
  // Not one of them left the device.
  expect(await listTransactions(request)).toEqual([]);

  // A reload with no network: the queue belongs to IndexedDB, not to the tab (invariant 7).
  await page.reload();
  await expect(page.getByText("You’re offline.")).toBeVisible();
  expect((await vaultState(page))?.pending).toBe(HOW_MANY);

  // And a cold start, which is the device the next morning: the page is gone, the vault is not.
  await page.close();
  const back = await coldStart(context);
  await expect(back.getByText(new RegExp(`${HOW_MANY} changes waiting`))).toBeVisible();
  expect((await vaultState(back))?.pending).toBe(HOW_MANY);
  await back.goto("/transactions");
  await expect(back.getByRole("button", { name: /Pending sync/ })).toHaveCount(HOW_MANY);
  // And it knows whose device this is: the amounts are euros, not the fallback currency, and the
  // sidebar names the user, all read from the mirror's profile (F-63).
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

// §1 example 2: the drain reaches the server and the answer is cut on the way back. The queue
// replays the whole batch; `POST /sync` remembers the opIds (D-2) and nothing lands twice.
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
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  expect((await vaultState(page))?.pending).toBe(1);

  // The first batch reaches the server and its answer is cut on the way back; the second is the
  // replay. Counted and read, not assumed: a queue that dropped the operation after the abort would
  // drain to zero and leave one row on the server too, so only the second answer saying `duplicate`
  // proves what the title says.
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
