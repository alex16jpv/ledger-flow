import { expect, test } from "@playwright/test";

import {
  addButton,
  createExpense,
  freshUser,
  listTransactions,
  readyForOffline,
  reportsNoNetwork,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";

// P-35 (owner, 2026-09-09): the rest of the offline suite cuts the network with `setOffline`, which
// leaves `navigator.onLine` **true** — a captive portal, and a case of its own that those specs keep
// measuring. These are the same flows in the other outage: a device that *reports* no network, which
// is a phone in a lift and the state the app was broken in. What they assert is data, never a
// heading: a heading paints with or without a vault.

test("changing module with no network reads the mirror on every screen", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "no-net-nav");

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await reportsNoNetwork(context);
  await page.goto("/home");

  // The greeting's name is the profile the pull stored (F-82): with no vault open there is none.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hi,/);
  await expect(page.getByText(user.accountName).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  for (const [link, resolved] of [
    ["Transactions", "Nothing recorded yet"],
    ["Budgets", "Put a ceiling on your small spending"],
  ] as const) {
    await page.getByRole("link", { name: link }).first().click();
    // Every hop is a document load with no network (T-01), and the app's own start-up navigation is
    // one more: waiting for the screen waits for both (F-45).
    await page.waitForLoadState("load");
    await expect(page.getByText(resolved)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  }

  await page.getByRole("link", { name: "Accounts" }).first().click();
  await page.waitForLoadState("load");
  const card = page.getByRole("link", { name: new RegExp(user.accountName) });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  // "Incluso recargando": the reload was the owner's own second try, and it changed nothing.
  await page.reload();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
});

test("a device that reports no network still records, and sends when it is back", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "no-net-write");
  const amount = uniqueAmount();

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await reportsNoNetwork(context);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();

  // Through the full form, which is what needs the pickers to have read the mirror: with no vault
  // open there is no account and no category to choose, so the save could not even be attempted.
  await createExpense(page, amount, "NO-NET latte");
  expect((await vaultState(page))?.pending).toBe(1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);

  // The network comes back. `navigator.onLine` still says no — the override cannot be taken off a
  // context — so what notices is the heartbeat, which is the slow path on purpose: if the queue
  // drains here it drains anywhere.
  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 120_000 }).toBe(0);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(1);
});

test("with no network and no session the marker opens the app, and the sheet stays away", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "no-net-dead");

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  // The session dies and the marker stays: §2.6's local mode, in the outage it was reported in.
  const kept = (await context.cookies()).filter(
    (cookie) => !cookie.name.includes("access") && !cookie.name.includes("refresh"),
  );
  await context.clearCookies();
  await context.addCookies(kept);
  await context.setOffline(true);
  await reportsNoNetwork(context);
  await page.goto("/home");

  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expect(page.getByText(user.accountName).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  // §8.17: two of the sheet's three exits need a network, so it does not ask while there is none.
  await expect(
    page.getByRole("dialog", { name: "This device has your data, but no session" }),
  ).toHaveCount(0);
  // And the app still works from what it holds: the queue is where a capture goes.
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(uniqueAmount()));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  expect((await vaultState(page))?.pending).toBe(1);
});
