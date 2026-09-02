import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };

async function signInAsSeed(
  page: Page,
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/dev/pickers");
  await expect(page.getByRole("heading", { level: 1, name: "Pickers" })).toBeVisible();
}

// Streaming can leave a hidden server copy of a segment in the DOM; visible-only locators ignore it.
function result(page: Page, id: string) {
  return page.getByTestId(id).locator("visible=true");
}

async function expectAccessibleDialog(page: Page) {
  const results = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  expect(results.violations).toEqual([]);
}

test("the category picker works with the keyboard alone and returns focus to the trigger", async ({
  page,
  request,
}) => {
  await signInAsSeed(page, request);
  const picker = page.getByRole("button", { name: /Category.*Choose a category/ });
  await picker.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Category" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Recent" }).getByRole("button")).toHaveCount(3);
  await expectAccessibleDialog(page);

  const search = dialog.getByRole("searchbox", { name: "Search categories" });
  if (!(await search.evaluate((element) => element === document.activeElement)))
    await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.type("Food");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("option", { name: /Food/ })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  await expect(result(page, "category-result")).toHaveText("Selected: Food");
  await expect(page.getByRole("button", { name: /Category.*Food/ })).toBeFocused();
});

test("switching to income refilters the categories and transfers show no recent strip", async ({
  page,
  request,
}) => {
  await signInAsSeed(page, request);
  await page.getByRole("button", { name: "Income" }).click();
  await page.getByRole("button", { name: /Choose a category/ }).click();
  const dialog = page.getByRole("dialog", { name: "Category" });
  await expect(dialog.getByRole("option", { name: /Salary/ })).toBeVisible();
  await expect(dialog.getByRole("option", { name: /Food/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByRole("button", { name: /Choose a category/ }).click();
  await expect(dialog.getByRole("option").first()).toBeVisible();
  await expect(dialog.getByRole("group", { name: "Recent" })).toHaveCount(0);
});

test("a new category can be created inline and becomes the selection", async ({
  page,
  request,
}) => {
  await signInAsSeed(page, request);
  const name = `E2E Gym ${Date.now()}`;
  await page.getByRole("button", { name: /Choose a category/ }).click();
  const dialog = page.getByRole("dialog", { name: "Category" });
  await dialog.getByRole("searchbox").fill(name);
  await expect(
    dialog.getByRole("heading", { name: `No categories match “${name}”` }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /New category/ }).click();

  const form = page.getByRole("dialog", { name: "New category" });
  await expect(form.getByLabel("Name")).toHaveValue(name);
  await form.getByRole("searchbox", { name: "Search icons" }).fill("dumbbell");
  await form.getByRole("button", { name: "dumbbell" }).click();
  await form.getByRole("button", { name: "Teal" }).click();
  await expectAccessibleDialog(page);
  await form.getByRole("button", { name: "Create category" }).click();

  await expect(form).toBeHidden();
  await expect(result(page, "category-result")).toHaveText(`Selected: ${name}`);

  const list = (await (await request.get("/api/categories?type=EXPENSE&limit=100")).json()) as {
    data: { id: string; name: string; icon: string; color: string }[];
  };
  const created = list.data.find((category) => category.name === name);
  expect(created).toMatchObject({ icon: "dumbbell", color: "TEAL" });
  await request.delete(`/api/categories/${created?.id}`, { headers: { origin: APP } });
});

test("the account picker lists balances with the main badge and excludes the other side of a transfer", async ({
  page,
  request,
}) => {
  await signInAsSeed(page, request);
  const from = page.getByRole("button", { name: /^From/ });
  await from.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Account" });
  await expect(dialog).toBeVisible();
  const main = dialog.getByRole("option", { name: /Bancolombia/ });
  await expect(main).toContainText("Main");
  // Balances move while the quick-add spec runs in parallel: assert the format, not the figure.
  await expect(main).toContainText(/\$\d{1,3}(,\d{3})+/);
  await expectAccessibleDialog(page);
  await expect(main).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(from).toContainText(/Bancolombia · \$\d{1,3}(,\d{3})+/);
  await expect(from).toBeFocused();

  await page.getByRole("button", { name: /^To/ }).click();
  await expect(dialog.getByRole("option", { name: /Bancolombia/ })).toHaveCount(0);
  await expect(dialog.getByRole("option", { name: /Cash/ })).toBeVisible();
});

test("the date field sends the current time until a time is chosen", async ({ page, request }) => {
  await signInAsSeed(page, request);
  await page.getByRole("textbox", { name: "Date" }).fill("2026-09-22");
  await expect(result(page, "instant-result")).toContainText(/2026-09-2[23]T\d\d:\d\d:00\.000Z/);
  await page.getByRole("textbox", { name: /Time/ }).fill("18:10");
  await expect(result(page, "instant-result")).toContainText("2026-09-22T23:10:00.000Z");
});

test("a new account can be created inline from the picker", async ({ page, request }) => {
  await signInAsSeed(page, request);
  const name = `E2E Nu ${Date.now()}`;
  await page.getByRole("button", { name: /^From/ }).click();
  await page
    .getByRole("dialog", { name: "Account" })
    .getByRole("button", { name: /New account/ })
    .click();
  const form = page.getByRole("dialog", { name: "New account" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Savings" }).click();
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(form).toBeHidden();
  await expect(result(page, "account-result")).toHaveText(`Selected: ${name}`);
  const list = (await (await request.get("/api/accounts?limit=100")).json()) as {
    data: { id: string; name: string }[];
  };
  const created = list.data.find((account) => account.name === name);
  expect(created).toBeDefined();
  await request.delete(`/api/accounts/${created?.id}`, { headers: { origin: APP } });
});
