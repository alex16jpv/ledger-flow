import { expect, type Page, test } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";
const SEED = { email: "seed@ledgerflow.test", password: "LedgerFlow!2026" };
type Request = Parameters<Parameters<typeof test>[2]>[0]["request"];

async function signIn(page: Page, request: Request) {
  const response = await request.post("/api/auth/login", { headers: { origin: APP }, data: SEED });
  expect(response.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
}

test("home shows the pending alert, the day bars, the top budgets and the latest movements", async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: /^Hi, / })).toBeVisible();

  const alert = page.getByRole("link", { name: /quick expenses? to review/ });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/\$\d/);
  const chart = page.getByRole("group", { name: "Spending per day" });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole("button").first()).toHaveAccessibleName(/ · \$/);

  const budgets = page.getByRole("heading", { level: 2, name: "Budgets" });
  await expect(budgets).toBeVisible();
  await expect(page.getByText(/left · on track|with \d+ days? left|Over by/).first()).toBeVisible();

  const accounts = page.getByRole("region", { name: "Accounts" });
  const firstAccount = accounts.getByRole("link").first();
  await expect(firstAccount).toBeVisible();
  const accountHref = await firstAccount.getAttribute("href");
  expect(accountHref).toMatch(/\/accounts\/[0-9a-f-]{36}$/);

  const recent = page.getByRole("region", { name: "Recent transactions" });
  await expect(recent.getByRole("button").first()).toContainText("To review");
  expect(await recent.getByRole("button").count()).toBe(5);
  await expectNoAxeViolations(page);

  await alert.click();
  await expect(page).toHaveURL(/\/transactions\/review$/);
  await page.goBack();
  await recent.getByRole("button").first().click();
  await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]{36}$/);
  await page.goBack();
  await firstAccount.click();
  await expect(page).toHaveURL(new RegExp(`${String(accountHref)}$`));
  await page.goBack();
  // T-80: only a browser says whether the pointer hovers, and that is what decides the tap's meaning.
  const canHover = await page.evaluate(() => !window.matchMedia("(hover: none)").matches);
  expect(canHover).toBe(test.info().project.name === "desktop");
  const day = chart.getByRole("button").first();
  await day.click();
  if (canHover) {
    await expect(page).toHaveURL(
      /\/transactions\?period=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&type=EXPENSE$/,
    );
  } else {
    await expect(page).toHaveURL(/\/home$/);
    await expect(day).toBeFocused();
    await expect(chart.locator("xpath=following-sibling::p[1]")).toHaveText(/\$/);
  }
});
