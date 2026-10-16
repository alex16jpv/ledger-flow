import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { freshUser, readyForOffline, signInAs } from "../offline";

const vaults = (page: Page): Promise<string[]> =>
  page.evaluate(async () =>
    (await indexedDB.databases())
      .map((info) => info.name ?? "")
      .filter((name) => name.startsWith("lf-vault-")),
  );

// T-166: the other tab used to open the copy again and download everything into it.
test("deleting everything here sends every tab to sign-in and nothing downloads it again", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120_000);
  const who = await freshUser(request, "wipe-two-tabs");
  await signInAs(context, request, who);
  await page.goto("/home");
  await readyForOffline(page);

  const other = await context.newPage();
  await other.goto("/settings/sync");
  await expect(other.getByRole("button", { name: "Delete local data" })).toBeVisible();
  await other.getByRole("button", { name: "Delete local data" }).click();
  await other.getByRole("button", { name: "Delete everything" }).click();

  for (const tab of [other, page]) {
    await expect(tab).toHaveURL(/\/login\?wiped=1$/, { timeout: 15_000 });
    await expect(tab.getByText("Everything on this device was deleted.")).toBeVisible();
  }
  await page.waitForTimeout(2_000);
  expect(await vaults(page)).toEqual([]);

  const me = await context.request.get("/api/auth/me");
  expect(me.status()).toBe(401);
});
