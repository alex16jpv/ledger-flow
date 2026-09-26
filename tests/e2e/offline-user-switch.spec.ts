import { expect, test } from "../fixtures";
import {
  accountIdsIn,
  createExpense,
  expectPending,
  freshUser,
  listAccounts,
  networkComesBack,
  readyForOffline,
  signInAs,
  storeCount,
  uniqueAmount,
  vaultState,
} from "../offline";

// T-152: the cookies are the browser's, so another user signing in reaches every tab still open.
test("a tab left on one user never downloads the next user's rows into its copy", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const first = await freshUser(request, "switch-first");
  const mine = (await listAccounts(request)).map((row) => row.id);
  const second = await freshUser(request, "switch-second");
  const theirs = (await listAccounts(request)).map((row) => row.id);

  await signInAs(context, request, first);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);
  const vault = (await vaultState(page))?.name ?? "";
  expect(await accountIdsIn(page, vault)).toEqual(mine);

  const pulled = page.waitForRequest((sent) => sent.url().includes("/api/sync/changes"));
  await networkComesBack(page);
  await pulled;

  await signInAs(context, request, second);
  await networkComesBack(page);

  await page.waitForTimeout(3_000);
  const kept = await accountIdsIn(page, vault);
  expect(kept).toEqual(mine);
  expect(kept.filter((id) => theirs.includes(id))).toEqual([]);
});

// T-167 (owner, 2026-09-26): the copy goes, its unsent work waits, and its tab follows the session.
test("another account signing in takes the previous copy and moves the tab still showing it", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(180_000);
  const first = await freshUser(request, "switch-away");
  const second = await freshUser(request, "switch-in");

  await signInAs(context, request, first);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);
  const vault = (await vaultState(page))?.name ?? "";
  expect(await accountIdsIn(page, vault)).not.toEqual([]);

  await context.route("**/api/sync", (route) => route.abort("internetdisconnected"));
  await createExpense(page, uniqueAmount(), "Left behind");
  await expectPending(page, 1);

  const other = await context.newPage();
  await other.goto("/login?reauth=1");
  await other.getByLabel("Email", { exact: true }).fill(second.email);
  await other.getByLabel("Password", { exact: true }).fill(second.password);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/home$/, { timeout: 15_000 });

  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  await expect(page.getByText("Another account signed in on this browser")).toBeVisible();
  await expect(page.getByText("Left behind")).toHaveCount(0);

  expect(await accountIdsIn(page, vault)).toEqual([]);
  expect(await storeCount(page, vault, "transactions")).toBe(0);
  expect(await storeCount(page, vault, "profile")).toBe(0);
  expect(await storeCount(page, vault, "outbox")).toBe(1);
});
