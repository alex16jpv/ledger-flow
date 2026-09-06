import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  addButton,
  APP,
  createExpense,
  freshUser,
  listTransactions,
  outbox,
  readyForOffline,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";

const DAY_MS = 86_400_000;

// §6 O-F7, third bullet, and trap 7.4: the device's clock runs days ahead, so what it records looks
// like the future to the server. The movement is never lost; it waits in the tray with the reason.
test("a clock days ahead earns a refusal the queue keeps, and says why", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "clock");
  const amount = uniqueAmount();

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  // Three days ahead: the form's own guard uses the device's clock, so it lets this through — it is
  // the server, with a clock of its own, that will not have it.
  await page.clock.setSystemTime(new Date(Date.now() + 3 * DAY_MS));
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();
  // Through the full form, which carries a date: a quick capture sends none, and the server dates
  // one of those by its own clock, so it could never be in the future.
  await createExpense(page, amount, "OF7 clock ahead");
  expect((await vaultState(page))?.pending).toBe(1);

  await context.setOffline(false);
  await page.goto("/home");
  await expect(page.getByText("Some changes need your attention.")).toBeVisible({
    timeout: 60_000,
  });
  await page.goto("/sync");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/change needs you/);
  await expect(page.getByText("The date can’t be in the future.")).toBeVisible();

  // Invariant 7: refused is not discarded. The movement is still on the device and still in the
  // queue, and the server never took it.
  expect((await outbox(page))[0]).toMatchObject({ status: "failed", lastError: "FUTURE_DATE" });
  expect(await listTransactions(request)).toEqual([]);
  expect((await vaultState(page))?.pending).toBe(1);
});

// §1 example 2 seen from the other side: the request never reaches the server. Nothing is applied,
// nothing is lost, and the queue goes out whole when the network comes back.
test("a request cut before the server sees it leaves the queue exactly as it was", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "cut");
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

  let cut = 0;
  await context.route("**/api/sync", async (route) => {
    if (cut >= 2) return route.continue();
    cut += 1;
    await route.abort("connectionfailed");
  });

  await context.setOffline(false);
  // The two cut attempts leave the operation where it was, with its place in the queue.
  await expect.poll(() => cut, { timeout: 60_000 }).toBe(2);
  expect(await listTransactions(request)).toEqual([]);
  const [queued] = await outbox(page);
  expect(queued).toMatchObject({ entity: "transaction", status: "pending" });

  // And the backoff brings it back on its own: nothing here asks for a retry.
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  const after = await listTransactions(request);
  expect(after).toHaveLength(1);
  expect(after[0]?.amount).toBe(amount);
});

// F-42: the refresh token is dead and the vault is not. The app opens, reads and writes; the queue
// waits for its own user to come back instead of asking a dead session every minute (F-26).
test("with a dead session the app still opens, reads and queues, and syncs after signing in again", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(240_000);
  const user = await freshUser(request, "local-mode");
  const seeded = await request.post("/api/transactions", {
    headers: { origin: APP },
    data: {
      type: "EXPENSE",
      amount: 4_321,
      fromAccountId: user.accountId,
      description: "Before the session died",
      date: new Date().toISOString(),
    },
  });
  expect(seeded.ok(), await seeded.text()).toBe(true);

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  const amount = uniqueAmount();
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

  // The session dies while the device is away. The marker stays, which is the whole of §2.6: it
  // says which vault this device holds, never that the session is good.
  const kept = (await context.cookies()).filter(
    (cookie) => !cookie.name.includes("access") && !cookie.name.includes("refresh"),
  );
  await context.clearCookies();
  await context.addCookies(kept);
  expect(kept.some((cookie) => cookie.name === "__Host-session")).toBe(true);

  // A cold start with no session and no network: the app opens `(app)`, not the login, and reads
  // its data from the mirror.
  await page.reload();
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Before the session died/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pending sync/ })).toHaveCount(1);

  // The network comes back but the session does not: the app offers the way in and the queue holds
  // where it is, instead of asking a dead session the same question every minute (F-26).
  await context.setOffline(false);
  await page.waitForTimeout(5_000);
  expect((await vaultState(page))?.pending).toBe(1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);

  // Opening the app with a network and a dead session: it says so and offers the way in, without
  // being a wall — the queue keeps growing behind it (§2.6).
  await page.reload();
  const dead = page.getByRole("dialog", { name: "Sign in to sync" });
  await expect(dead).toBeVisible({ timeout: 30_000 });
  await dead.getByRole("button", { name: "Sign in to sync" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/transactions$/);

  // Same user, so the queue is theirs to send.
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(1);
});

// §6 O-F7's last bullet: the strip that says there is no network is itself reachable.
test("the connection strip passes axe with no network and with a queue behind it", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "banner");

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(uniqueAmount()));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(/1 change waiting/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // And the same strip once it has something the user has to answer.
  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  await expect(page.getByText(/changes? waiting/)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
