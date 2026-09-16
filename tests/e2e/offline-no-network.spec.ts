import { expect, test } from "../fixtures";
import {
  addButton,
  createExpense,
  expectPending,
  freshUser,
  listTransactions,
  readyForOffline,
  reportsNoNetwork,
  signInAs,
  uniqueAmount,
  vaultState,
} from "../offline";
import { goToSection } from "./nav";

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

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Hi,/);
  await expect(page.getByText(user.accountName).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

  for (const [link, resolved] of [
    ["Transactions", "Nothing recorded yet"],
    ["Budgets", "Put a ceiling on your small spending"],
  ] as const) {
    await page.getByRole("link", { name: link }).first().click();
    await page.waitForLoadState("load");
    await expect(page.getByText(resolved)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  }

  await goToSection(page, "Accounts");
  await page.waitForLoadState("load");
  const card = page.getByRole("link", { name: new RegExp(user.accountName) });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);

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

  await createExpense(page, amount, "NO-NET latte");
  await expectPending(page, 1);
  expect((await listTransactions(request)).filter((row) => row.amount === amount)).toHaveLength(0);

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
  await expect(
    page.getByRole("dialog", { name: "This device has your data, but no session" }),
  ).toHaveCount(0);
  await addButton(page).click();
  const sheet = page.getByRole("dialog", { name: "Add expense" });
  await expect(sheet.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type(String(uniqueAmount()));
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expectPending(page, 1);
  await expect(page.getByText("1 to review").first()).toBeAttached();
});
