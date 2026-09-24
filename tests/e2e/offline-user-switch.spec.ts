import { expect, type Page, test } from "../fixtures";
import { freshUser, listAccounts, readyForOffline, signInAs, vaultState } from "../offline";

async function networkComesBack(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

function accountIdsIn(page: Page, vault: string): Promise<string[]> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("open failed"));
      };
    });
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = db.transaction("accounts", "readonly").objectStore("accounts").getAllKeys();
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("read failed"));
      };
    });
    db.close();
    return keys.map(String);
  }, vault);
}

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
