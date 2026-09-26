import { expect, test } from "../fixtures";
import {
  accountIdsIn,
  APP,
  freshUser,
  listAccounts,
  networkComesBack,
  readyForOffline,
  signInAs,
  vaultState,
} from "../offline";

// D-14: the feed replays the 60 seconds before its cursor, which would hide the lost rows.
const PAST_THE_FEED_OVERLAP_MS = 65_000;

// T-164: the page in flight used to land after the purge, and the copy kept only what followed it.
test("a resync while a pull is downloading leaves the whole copy", async ({
  page,
  request,
  context,
}) => {
  test.skip(test.info().project.name === "desktop", "a minute of waiting, and the same engine");
  test.setTimeout(180_000);
  const who = await freshUser(request, "resync-in-flight");
  const created = await request.post("/api/accounts", {
    headers: { origin: APP },
    data: { name: "Savings", type: "SAVINGS", balance: 0 },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const mine = (await listAccounts(request)).map((row) => row.id).sort();

  await signInAs(context, request, who);
  await page.goto("/settings/sync");
  await readyForOffline(page);
  const vault = (await vaultState(page))?.name ?? "";
  expect((await accountIdsIn(page, vault)).sort()).toEqual(mine);

  await page.waitForTimeout(PAST_THE_FEED_OVERLAP_MS);
  const advanced = context.waitForEvent("requestfinished", (done) =>
    done.url().includes("/api/sync/changes"),
  );
  await networkComesBack(page);
  await advanced;

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached: () => void = () => undefined;
  const inFlight = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let holding = true;
  // The context, not the page: once the worker controls the page, its fetches skip `page.route`.
  await context.route("**/api/sync/changes**", async (route) => {
    if (holding) {
      holding = false;
      reached();
      await held;
    }
    await route.continue();
  });
  await networkComesBack(page);
  await inFlight;

  await page.getByRole("button", { name: "Force full resync" }).click();
  await page.getByRole("button", { name: "Resync now" }).click();
  await expect.poll(() => accountIdsIn(page, vault)).toEqual([]);
  release();

  await expect(page.getByText("Resynced")).toBeVisible();
  expect((await accountIdsIn(page, vault)).sort()).toEqual(mine);
});
