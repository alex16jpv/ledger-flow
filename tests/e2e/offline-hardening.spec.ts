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
import { expectNoAxeViolations } from "./axe";

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
  // F-66: the card names the date it refused and how far this device's clock is from the server's.
  await expect(page.getByText(/is more than 24 hours ahead of the server’s time/)).toBeVisible();
  await expect(page.getByText(/clock is 3 days ahead/)).toBeVisible();

  // Invariant 7: refused is not discarded. The movement is still on the device and still in the
  // queue, and the server never took it.
  expect((await outbox(page))[0]).toMatchObject({ status: "failed", lastError: "FUTURE_DATE" });
  expect(await listTransactions(request)).toEqual([]);
  expect((await vaultState(page))?.pending).toBe(1);

  // F-66, the way out: the date is corrected to the server's own clock and the same movement goes.
  await page.getByRole("button", { name: "Fix the date" }).click();
  const sheet = page.getByRole("dialog", { name: "Fix the date" });
  await expect(sheet.getByText("The server refused this date.")).toBeVisible();
  await sheet.getByRole("button", { name: "Save and try again" }).click();

  await expect
    .poll(async () => (await listTransactions(request)).length, { timeout: 60_000 })
    .toBe(1);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 60_000 }).toBe(0);
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
  await expectNoAxeViolations(page);

  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(uniqueAmount()));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(/1 change waiting/)).toBeVisible();
  await expectNoAxeViolations(page);

  // And the same strip once it has something the user has to answer.
  await context.setOffline(false);
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  await expect(page.getByText(/changes? waiting/)).toHaveCount(0);
  await expectNoAxeViolations(page);
});

// F-64: the session dies while the app stays open. Nothing is reloaded, so whatever says so has to
// come from the request that got the 401 — until it does, the queue stops with no explanation.
test("a session that dies with the app open says so without a reload", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "dead-open");
  const amount = uniqueAmount();

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  // The outage: something is queued with no network, and the session dies while the device is away.
  await context.setOffline(true);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();

  // The session dies, the tab does not: no reload, no navigation, the vault marker kept (§2.6).
  const kept = (await context.cookies()).filter(
    (cookie) => !cookie.name.includes("access") && !cookie.name.includes("refresh"),
  );
  await context.clearCookies();
  await context.addCookies(kept);

  // Something to send, so the queue asks the server and earns the 401.
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(amount));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  expect((await vaultState(page))?.pending).toBe(1);

  // A cold start with no session and no network: the app opens in local mode (§2.6), which is the
  // state F-64 was reported in — the tab that will have to speak is this one.
  await page.reload();
  await expect(page.getByText("You’re offline.")).toBeVisible();

  // The network comes back and nobody reloads anything: the queue asks, gets its 401, and the only
  // thing that can tell the user why nothing syncs is this tab.
  await context.setOffline(false);

  // Well under the 30 s of the heartbeat: the app must not need the tick to notice. What tells it is
  // the answer to the request it just made — a 401 is still an answer, and only the network can
  // deliver one (F-64). Before that hint existed, this sheet took a whole tick to appear.
  const dead = page.getByRole("dialog", { name: "Sign in to sync" });
  await expect(dead).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("You’re offline.")).toHaveCount(0);

  // And the change is still here: a dead session never costs the queue anything (invariant 7).
  expect((await vaultState(page))?.pending).toBe(1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);
});

// P-33 (owner, 2026-09-08): with no network the root has to open the app too. The proxy cannot do
// it — nothing on the server runs — and the landing document is not in the cache either, because a
// signed-in device is redirected before it ever gets one. The worker answers with the redirect.
test("with no network the root opens the app on a device that holds it", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "root");
  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await page.goto("/");

  await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
  await expect(page.getByText("You’re offline.")).toBeVisible();
});
