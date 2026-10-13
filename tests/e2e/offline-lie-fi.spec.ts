import { type BrowserContext, expect, type Page, test } from "../fixtures";
import { APP, freshUser, readyForOffline, signInAs, vaultState } from "../offline";

// T-264: a working network answers well inside this; the old code waited 15 s and more per save.
const ANSWERED_IN_TIME = 8_000;

// A road with signal and no internet: nothing fails, every request just never comes back.
async function networkHangs(context: BrowserContext, pattern = "**/api/**"): Promise<void> {
  await context.route(pattern, () => undefined);
}

async function synced(page: Page): Promise<void> {
  await expect
    .poll(async () => (await vaultState(page))?.syncedAt, { timeout: 60_000 })
    .toEqual(expect.any(String));
}

test("a group expense saves at once while the network hangs", async ({
  page,
  request,
  context,
}) => {
  const user = await freshUser(request, "lie-fi-group");
  const post = async (path: string, data: unknown) => {
    const response = await request.post(path, { headers: { origin: APP }, data });
    expect(response.ok()).toBe(true);
    return (await response.json()) as { id: string };
  };
  const ana = await post("/api/contacts", { name: "Ana Ruiz" });
  const group = await post("/api/shared-groups", { name: "Road trip", contactIds: [ana.id] });
  await signInAs(context, request, user);
  await page.goto(`/shared/groups/${group.id}`);
  await expect(page.getByRole("heading", { level: 2, name: "Road trip" })).toBeVisible();
  await synced(page);

  await networkHangs(context);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Record a new expense" }).click();
  await page.getByRole("textbox", { name: "Amount" }).fill("84000");
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("combobox", { name: /^Description/ }).fill("Fuel");
  await page.getByRole("button", { name: "Save and add to the group" }).click();

  await expect(page.getByRole("heading", { name: "Expenses · 1" })).toBeVisible({
    timeout: ANSWERED_IN_TIME,
  });
  await expect(page.getByText("Fuel")).toBeVisible();
});

test("a transaction saves at once while the network hangs", async ({ page, request, context }) => {
  const user = await freshUser(request, "lie-fi-form");
  await signInAs(context, request, user);
  await page.goto("/transactions/new?amount=12500&description=Toll");
  await expect(page.getByRole("heading", { level: 1, name: "New transaction" })).toBeVisible();
  await synced(page);

  await networkHangs(context);
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("dialog", { name: "Account" }).getByRole("option", { name: /Cash/ }).click();
  await page.getByRole("button", { name: "Save transaction" }).click();

  await expect(page).toHaveURL(/\/transactions(\?|$)/, { timeout: ANSWERED_IN_TIME });
  await expect(page.getByRole("button", { name: /Toll.*Pending sync/ })).toBeVisible();
});

test("the installed app opens with the network hanging instead of a blank screen", async ({
  page,
  request,
  context,
}) => {
  // Installing the worker and warming the shell is the slow part, as in offline-shell.spec.ts.
  test.setTimeout(180_000);
  const user = await freshUser(request, "lie-fi-open");
  await signInAs(context, request, user);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await readyForOffline(page);
  // The browser's own preload request is out of Playwright's reach, so the worker fetches for itself.
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then((registration) => registration.navigationPreload.disable()),
  );

  await networkHangs(context, "**/*");
  // `/` is the app's start_url: the worker sends a device that holds the app on to Home.
  await page.goto("/", { waitUntil: "commit" });

  await expect(page).toHaveURL(/\/home$/, { timeout: ANSWERED_IN_TIME * 2 });
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: ANSWERED_IN_TIME,
  });
});
