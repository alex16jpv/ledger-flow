import { expect, test } from "../fixtures";
import {
  accountIdsIn,
  freshUser,
  listAccounts,
  networkComesBack,
  readyForOffline,
  signInAs,
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
