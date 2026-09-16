import { expect, test, uniqueEmail } from "../fixtures";
import { expectNoAxeViolations } from "./axe";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

async function signUp(
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
  name = "John Doe",
) {
  const email = uniqueEmail("shell");
  const response = await request.post("/api/auth/register", {
    headers: { origin: APP },
    data: { name, email, password: "LedgerFlow!2026", locale: "en" },
  });
  expect(response.status()).toBe(201);
}

test("the app shell shows navigation, greeting and passes axe", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, John");
  await expect(page.getByRole("navigation", { name: "Navigation" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectNoAxeViolations(page);
});

// T-72: below 900px Stats and Categories had no way in at all; More is the only door there is.
test("the phone reaches Stats, Categories and Accounts through More", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(!isMobile, "the tab bar only exists below 900px");
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");

  const more = page.getByRole("button", { name: "More", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  const sheet = page.getByRole("dialog", { name: "More" });
  await expect(sheet).toBeVisible();
  await expectNoAxeViolations(page);
  for (const name of ["Accounts", "Stats", "Categories", "Settings"]) {
    await expect(sheet.getByRole("link", { name })).toBeVisible();
  }

  await sheet.getByRole("link", { name: "Stats" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(sheet).toBeHidden();
});

test("unknown routes answer a real 404", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("the app segment is noindex", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
