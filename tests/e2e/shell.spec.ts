import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const APP = process.env.E2E_APP_URL ?? "http://localhost:3002";

async function signUp(
  request: Parameters<Parameters<typeof test>[2]>[0]["request"],
  name = "Andrés Valencia",
) {
  const email = `e2e-shell-${Date.now()}-${Math.random().toString(16).slice(2)}@ledgerflow.test`;
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Andrés");
  await expect(page.getByRole("navigation", { name: "Navigation" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Home" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("unknown routes answer a real 404", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Page not found");
});

test("the app segment is noindex", async ({ page, request }) => {
  await signUp(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto("/home");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
