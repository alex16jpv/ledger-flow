import { expect, test } from "../fixtures";
import {
  addButton,
  APP,
  createExpense,
  expectPending,
  freshUser,
  listTransactions,
  outbox,
  readyForOffline,
  reportsNoNetwork,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";
import { expectNoAxeViolations } from "./axe";

const DAY_MS = 86_400_000;

// §6 O-F7 and trap 7.4: a clock days ahead records what looks like the future to the server.
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
  // Three days ahead: the form's guard uses the device's clock, so it lets this through.
  await page.clock.setSystemTime(new Date(Date.now() + 3 * DAY_MS));
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();
  // A quick capture sends no date, so the server dates it and it could never be in the future.
  await createExpense(page, amount, "OF7 clock ahead");
  await expectPending(page, 1);

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

  // Invariant 7: refused is not discarded — it is still on the device and still in the queue.
  expect((await outbox(page))[0]).toMatchObject({ status: "failed", lastError: "FUTURE_DATE" });
  expect(await listTransactions(request)).toEqual([]);
  await expectPending(page, 1);

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

// §1 example 2: the request never reaches the server, so nothing is applied and nothing lost.
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
  let letThrough = false;
  await context.route("**/api/sync", async (route) => {
    if (letThrough) return route.continue();
    cut += 1;
    await route.abort("connectionfailed");
  });

  await context.setOffline(false);
  // H-08: cutting until the queue has been read — the backoff is 1–2 s and a loaded round trip is longer.
  await expect.poll(() => cut, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  expect(await listTransactions(request)).toEqual([]);
  await expect
    .poll(async () => (await outbox(page))[0], { timeout: 30_000 })
    .toMatchObject({ entity: "transaction", status: "pending" });

  // And the backoff brings it back on its own: nothing here asks for a retry.
  letThrough = true;
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  const after = await listTransactions(request);
  expect(after).toHaveLength(1);
  expect(after[0]?.amount).toBe(amount);
});

// F-42 with F-26: the refresh token is dead, the vault is not, and the queue waits for its user.
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
  await expectPending(page, 1);

  // §2.6: the marker stays — it says which vault this device holds, never that the session is good.
  const kept = (await context.cookies()).filter(
    (cookie) => !cookie.name.includes("access") && !cookie.name.includes("refresh"),
  );
  await context.clearCookies();
  await context.addCookies(kept);
  expect(kept.some((cookie) => cookie.name === "__Host-session")).toBe(true);

  // A cold start with no session and no network opens `(app)`, not the login.
  await page.reload();
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Before the session died/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pending sync/ })).toHaveCount(1);

  // F-26: network back, session not — the queue holds instead of asking every minute.
  await context.setOffline(false);
  await page.waitForTimeout(5_000);
  await expectPending(page, 1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);

  // §2.6: with a network and a dead session it says so without being a wall.
  await page.reload();
  // P-32 (2026-09-08): the title says what the device has, not what it lost.
  const dead = page.getByRole("dialog", { name: "This device has your data, but no session" });
  await expect(dead).toBeVisible({ timeout: 30_000 });
  await dead.getByRole("button", { name: "Sign in to sync" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(user.email);
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

// F-64: nothing is reloaded, so what says so has to come from the request that got the 401.
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
  await expectPending(page, 1);

  // §2.6: a cold start with no session and no network opens in local mode, where F-64 was seen.
  await page.reload();
  await expect(page.getByText("You’re offline.")).toBeVisible();

  // Nobody reloads anything: the queue asks, gets its 401, and only this tab can say why.
  await context.setOffline(false);

  // F-64: well under the 30 s tick — a 401 is still an answer, and only the network delivers one.
  const dead = page.getByRole("dialog", { name: "This device has your data, but no session" });
  await expect(dead).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("You’re offline.")).toHaveCount(0);

  // And the change is still here: a dead session never costs the queue anything (invariant 7).
  await expectPending(page, 1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);
});

// P-32 (owner, 2026-09-08): the app must behave as with no network, with the network right there.
test("the chosen local-only mode sends nothing to the server, and can be left", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "local-only");
  const amount = uniqueAmount();
  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  // The choice is a device preference, like the palette: the sheet writes it and the app reads it.
  await page.evaluate(() => {
    window.localStorage.setItem("lf.localOnly", "1");
  });
  const calls: string[] = [];
  page.on("request", (outgoing) => {
    const path = new URL(outgoing.url()).pathname;
    if (path.startsWith("/api/")) calls.push(`${outgoing.method()} ${path}`);
  });
  await page.reload();

  await expect(page.getByText("You’re working on this device only.")).toBeVisible();
  await createExpense(page, amount, "LOCAL-ONLY latte");
  // Not "few": none. Reads come from the mirror and writes go to the queue (DESIGN §8.17).
  expect(calls).toEqual([]);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);
  await expectPending(page, 1);

  // And leaving it is one line: the queue goes out on the next pass.
  await page.evaluate(() => {
    window.localStorage.removeItem("lf.localOnly");
  });
  await page.reload();
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(1);
});

// P-33 (owner, 2026-09-08): nothing on the server runs, so the worker answers with the redirect.
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

test("a device opened with no network shows what it holds, not skeletons", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "cold-start");

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  await context.setOffline(true);
  await reportsNoNetwork(context);
  await page.goto("/home");
  await expect(page.getByText("You’re offline.")).toBeVisible();
  await expect(page.getByText(user.accountName).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hi,/);

  await page.goto("/accounts");
  await expect(page.getByRole("link", { name: new RegExp(user.accountName) })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
});

test("signing in from the stripe ends this-device-only mode", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const user = await freshUser(request, "leave-local");

  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);

  const kept = (await context.cookies()).filter(
    (cookie) => !cookie.name.includes("access") && !cookie.name.includes("refresh"),
  );
  await context.clearCookies();
  await context.addCookies(kept);
  await page.reload();

  const choice = page.getByRole("dialog", { name: "This device has your data, but no session" });
  await expect(choice).toBeVisible({ timeout: 30_000 });
  await choice.getByRole("button", { name: "Continue on this device only" }).click();
  await expect(page.getByText("You’re working on this device only.")).toBeVisible();

  await page.getByRole("button", { name: "Sign in to sync" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/home/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hi,/);
  await expect(page.getByText("You’re working on this device only.")).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("lf.localOnly"))).toBeNull();
  await expect.poll(async () => (await vaultState(page))?.pending, { timeout: 90_000 }).toBe(0);
});
